import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import type { ArticleStatus } from "@/lib/article";
import { depositToCrossref } from "@/lib/crossref";
import { depositPublishedArticleToZenodo, zenodoLiveMode } from "@/lib/zenodo";
import { putObject, getObject } from "@/lib/storage";
import { renderMinimalErrorPdf } from "@/lib/galley";
import { computeArticleContentHash, sha256 } from "@/lib/article-provenance-server";
import { generateGlossary } from "@/lib/glossary";
import { suggestKeywordsAndSummary } from "@/lib/manuscript-checks";
import { generateGalleysForArticle } from "@/lib/galley-regenerate";
import { APP_BASE_URL } from "@/lib/site";
import { APC_USD } from "@/lib/pricing";
import { upsertArticleDocument, meilisearchLiveMode } from "@/lib/meilisearch";

/**
 * POST /api/articles/workflow
 * Transition an article through its state machine.
 * Editor-only (or SUPER_ADMIN).
 *
 * Body: { articleId, action, note? }
 * action ∈: SEND_TO_REVIEW, REQUEST_REVISIONS, ACCEPT, REJECT, SEND_TO_PRODUCTION, PUBLISH, WITHDRAW
 *
 * On PUBLISH:
 *   1. Activates the DOI (draft → published suffix).
 *   2. Fires a real Crossref XML deposit (api.test.crossref.org with
 *      simulation fallback if no credentials).
 *   3. Calls the pandoc-worker mini-service to generate HTML, PDF, and
 *      JATS galleys from the submitted manuscript, then persists them to
 *      the storage layer under published-galleys/.
 *   4. If openReview is enabled, marks all completed reviews as madePublic.
 *   5. Updates the OAI-PMH feed implicitly (next harvester request will
 *      include the new record).
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromHeaders(req.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!["EDITOR", "ASSOCIATE_EDITOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  try {
    const { articleId, action, note } = (await req.json()) as {
      articleId: string;
      action: string;
      note?: string;
    };

    const article = await db.article.findUnique({
      where: { id: articleId },
      include: { journal: true, issue: true },
    });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Compute next status from action
    const TRANSITIONS: Record<string, ArticleStatus> = {
      SEND_TO_REVIEW: "UNDER_REVIEW",
      REQUEST_REVISIONS: "REVISIONS_REQUIRED",
      ACCEPT: "ACCEPTED",
      REJECT: "REJECTED",
      SEND_TO_PRODUCTION: "IN_PRODUCTION",
      PUBLISH: "PUBLISHED",
      WITHDRAW: "WITHDRAWN",
    };

    const next = TRANSITIONS[action];
    if (!next) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const patch: any = { status: next };
    if (next === "ACCEPTED") patch.acceptedAt = new Date();
    if (next === "PUBLISHED") {
      patch.publishedAt = new Date();
      // Activate DOI: draft suffix → published suffix
      if (article.doi && article.doi.includes(".draft.")) {
        const newDoi = article.doi.replace(".draft.", ".2024.");
        patch.doi = newDoi;
        patch.doiStatus = "PUBLISHED";
      } else if (article.doi) {
        patch.doiStatus = "PUBLISHED";
      }
      // Galley keys will be set below by the production pipeline.
    }

    const updated = await db.article.update({ where: { id: articleId }, data: patch });
    let finalDoi = updated.doi;

    // Editorial decision log
    const decisionRow = await db.editorialDecision.create({
      data: {
        articleId,
        editorId: session.userId,
        decision: action,
        note: note || null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.userId,
        action: action,
        entityType: "ARTICLE",
        entityId: articleId,
        articleId,
        metadata: JSON.stringify({ from: article.status, to: next, doi: updated.doi }),
      },
    });

    // ----- On PUBLISH: fire the full production + indexing fan-out -----
    if (next === "PUBLISHED") {
      const publishEvents: string[] = [];

      // 1. Production: generate galleys via the pandoc-worker mini-service.
      //    Runs before the DOI deposit below so a real PDF galley is
      //    available to attach to the Zenodo deposition when that path
      //    is active (Zenodo requires at least one file per record).
      let generatedPdfKey: string | null = null;
      try {
        const galleyResults = await generateGalleysForArticle(updated.id);
        if (galleyResults) {
          await db.article.update({
            where: { id: articleId },
            data: {
              galleyHtmlKey: galleyResults.htmlKey,
              galleyPdfKey: galleyResults.pdfKey,
              galleyJatsKey: galleyResults.jatsKey,
              galleyEpubKey: galleyResults.epubKey,
            },
          });
          generatedPdfKey = galleyResults.pdfKey;
          publishEvents.push(
            `Galleys generated (html=${galleyResults.htmlKey}, pdf=${galleyResults.pdfKey}, jats=${galleyResults.jatsKey || "—"}, epub=${galleyResults.epubKey || "—"})`
          );
        }
      } catch (e: any) {
        console.error(`[workflow] Galley generation failed for article ${articleId}:`, e);
        publishEvents.push(`Galley generation failed: ${e.message}`);
        // Fall back to placeholder galley keys — and actually write content
        // at those keys, since a key with nothing behind it is a dead
        // download link for readers.
        const suffix = updated.doi?.split(".").pop() || Math.floor(Math.random() * 90000) + 10000;
        const pdfKey = `published-galleys/${suffix}.pdf`;
        const htmlKey = `published-galleys/${suffix}.html`;
        const placeholderHtml = `<!DOCTYPE html><html><body><h1>${updated.title}</h1><p>${updated.abstract}</p><p><em>Galley rendering is temporarily unavailable; this is a plain-text fallback.</em></p></body></html>`;
        const placeholderPdf = await renderMinimalErrorPdf({ title: updated.title });
        await Promise.all([
          putObject(htmlKey, Buffer.from(placeholderHtml, "utf-8"), "text/html; charset=utf-8"),
          putObject(pdfKey, placeholderPdf, "application/pdf"),
        ]);
        await db.article.update({
          where: { id: articleId },
          data: { galleyPdfKey: pdfKey, galleyHtmlKey: htmlKey },
        });
      }

      // 1b. Glossary and lay summary: both feed the Supplemental Materials
      //     tab, which needs real content by the time a reader first opens
      //     it — not only after an editor remembers to trigger AI Assist.
      //     Both are best-effort and never block publish. The glossary has
      //     no offline fallback (a wrong technical-term definition is
      //     actively misleading), so it honestly stores mode: "unavailable"
      //     rather than a fabricated definition list when no LLM is
      //     configured or the call fails. The lay summary reuses the same
      //     heuristic fallback the manual "AI Assist" action already has
      //     (src/lib/manuscript-checks.ts) since a plain-language summary
      //     degrades gracefully — an extractive fallback is lower quality
      //     but not misleading — so it's still worth setting.
      try {
        const glossaryResult = await generateGlossary({
          title: updated.title,
          abstract: updated.abstract,
          keywords: updated.keywords,
          discipline: updated.discipline,
        });
        await db.article.update({
          where: { id: articleId },
          data: {
            glossary: JSON.stringify(glossaryResult.terms),
            glossaryMeta: JSON.stringify({
              mode: glossaryResult.mode,
              model: glossaryResult.model,
              generatedAt: glossaryResult.generatedAt,
            }),
          },
        });
        publishEvents.push(`Glossary ${glossaryResult.mode === "llm" ? `generated (${glossaryResult.terms.length} terms)` : "unavailable — no LLM configured"}`);
      } catch (e: any) {
        console.error(`[workflow] Glossary generation failed for article ${articleId}:`, e);
        publishEvents.push(`Glossary generation failed: ${e.message}`);
      }

      // Only auto-generate the lay summary if no one already ran AI Assist
      // (or hand-wrote one) during drafting — never overwrite a
      // human-reviewed summary with a fresh auto-generated one.
      if (!updated.laySummary) {
        try {
          const summaryResult = await suggestKeywordsAndSummary({
            title: updated.title,
            abstract: updated.abstract,
            keywords: updated.keywords,
          });
          await db.article.update({
            where: { id: articleId },
            data: {
              laySummary: summaryResult.laySummary,
              aiKeywordSuggestions: JSON.stringify(summaryResult.suggestedKeywords),
            },
          });
          publishEvents.push(`Lay summary ${summaryResult.mode === "llm" ? "generated" : "generated (heuristic fallback — no LLM configured)"}`);
        } catch (e: any) {
          console.error(`[workflow] Lay summary generation failed for article ${articleId}:`, e);
          publishEvents.push(`Lay summary generation failed: ${e.message}`);
        }
      }

      // 2. DOI deposit. Prefers Zenodo (free, real, permanently-resolving
      //    DOI — see src/lib/zenodo.ts) whenever ZENODO_TOKEN is configured.
      //    Falls back to the Crossref sandbox/simulation path otherwise,
      //    matching pre-Zenodo behavior for journals without either set up
      //    yet. The two are mutually exclusive per article: a Zenodo DOI
      //    lives under Zenodo's own prefix and can't also be deposited to
      //    Crossref (that requires owning the DOI's prefix).
      {
        try {
          if (zenodoLiveMode()) {
            // Galleys were already generated and persisted above, so this
            // fetch sees the current galleyPdfKey and falls back to the raw
            // manuscript / a synthesized text file if neither exists.
            const deposit = await depositPublishedArticleToZenodo(updated.id);
            if (deposit.ok && deposit.doi) finalDoi = deposit.doi;
            publishEvents.push(
              `Zenodo deposit ${deposit.ok ? "succeeded" : "failed"} (mode=${deposit.mode}${deposit.doi ? `, doi=${deposit.doi}` : ""}${!deposit.ok ? `: ${deposit.message}` : ""})`
            );

            await db.auditLog.create({
              data: {
                userId: session.userId,
                action: "DOI_DEPOSIT",
                entityType: "ARTICLE",
                entityId: articleId,
                articleId,
                metadata: JSON.stringify({
                  provider: "ZENODO",
                  ok: deposit.ok,
                  mode: deposit.mode,
                  doi: deposit.doi,
                  recordUrl: deposit.recordUrl,
                  message: deposit.message,
                }),
              },
            });
          } else {
            const deposit = await depositToCrossref({
              article: updated as any,
              articleUrl: `${APP_BASE_URL}/article/${updated.id}`,
            });
            await db.article.update({
              where: { id: articleId },
              data: {
                crossrefBatchId: deposit.batchId,
                crossrefDepositedAt: deposit.depositedAt,
                crossrefDepositLog: JSON.stringify({
                  ok: deposit.ok,
                  mode: deposit.mode,
                  status: deposit.status,
                  statusText: deposit.statusText,
                  responseBody: deposit.responseBody.slice(0, 4000),
                  endpoint: deposit.endpoint,
                  batchId: deposit.batchId,
                  depositedAt: deposit.depositedAt.toISOString(),
                }),
              },
            });
            publishEvents.push(
              `Crossref deposit ${deposit.ok ? "succeeded" : "failed"} (mode=${deposit.mode}, batch=${deposit.batchId}, status=${deposit.status})`
            );

            await db.auditLog.create({
              data: {
                userId: session.userId,
                action: "DOI_DEPOSIT",
                entityType: "ARTICLE",
                entityId: articleId,
                articleId,
                metadata: JSON.stringify({
                  provider: "CROSSREF",
                  ok: deposit.ok,
                  mode: deposit.mode,
                  batchId: deposit.batchId,
                  status: deposit.status,
                  statusText: deposit.statusText,
                  endpoint: deposit.endpoint,
                }),
              },
            });
          }
        } catch (e: any) {
          publishEvents.push(`DOI deposit threw: ${e.message}`);
        }
      }

      // 2b. Digital provenance — compute the record's real content hash
      // now that the galleys and DOI are both finalized. Hashes the actual
      // PDF/EPUB bytes just persisted to storage (not just their keys), so
      // any later alteration of either file — or of the locked-in metadata
      // below — breaks the match at /verify/article/[id]. Best-effort: a
      // failure here never blocks publish, it just means this article
      // isn't verifiable yet (same honesty convention as the glossary/lay
      // summary generation above).
      try {
        const current = await db.article.findUniqueOrThrow({ where: { id: articleId } });
        const [pdfBytes, epubBytes] = await Promise.all([
          current.galleyPdfKey ? getObject(current.galleyPdfKey) : Promise.resolve(null),
          current.galleyEpubKey ? getObject(current.galleyEpubKey) : Promise.resolve(null),
        ]);
        const galleyPdfHash = pdfBytes ? sha256(pdfBytes) : null;
        const galleyEpubHash = epubBytes ? sha256(epubBytes) : null;
        const contentHash = computeArticleContentHash({
          id: current.id,
          title: current.title,
          authors: current.authors,
          abstract: current.abstract,
          doi: finalDoi,
          publishedAtIso: current.publishedAt ? current.publishedAt.toISOString() : null,
          contentType: current.contentType,
          discipline: current.discipline,
          insightCategory: current.insightCategory,
          keyTakeaways: current.keyTakeaways,
          galleyPdfHash,
          galleyEpubHash,
        });
        await db.article.update({
          where: { id: articleId },
          data: { contentHash, galleyPdfHash, galleyEpubHash },
        });
        publishEvents.push(`Digital provenance sealed (content hash ${contentHash.slice(0, 12)}…).`);
      } catch (e: any) {
        publishEvents.push(`Digital provenance sealing failed: ${e.message}`);
      }

      // 3. Open peer review: mark all completed reviews as publicly visible.
      if (article.openReview) {
        const result = await db.review.updateMany({
          where: { articleId, status: "COMPLETED" },
          data: { madePublic: true },
        });
        publishEvents.push(`Open review: ${result.count} review(s) marked public.`);
      }

      // 4. OAI-PMH feed implicitly includes the new record on next harvest.
      publishEvents.push("OAI-PMH feed will reflect this article on next harvester request.");

      // 4b. Meilisearch index — best-effort, never blocks publish (see
      // src/lib/meilisearch.ts, fails open when MEILISEARCH_HOST isn't set).
      try {
        await upsertArticleDocument({
          id: updated.id,
          title: updated.title,
          abstract: updated.abstract,
          keywords: updated.keywords,
          authors: updated.authors,
          discipline: updated.discipline,
          doi: finalDoi,
          publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
        });
        publishEvents.push(meilisearchLiveMode() ? "Meilisearch index updated." : "Meilisearch not configured — search index unchanged.");
      } catch (e: any) {
        publishEvents.push(`Meilisearch sync failed: ${e.message}`);
      }

      // 5. Audit + notify.
      await db.auditLog.create({
        data: {
          userId: session.userId,
          action: "DOI_PUBLISH",
          entityType: "ARTICLE",
          entityId: articleId,
          articleId,
          metadata: JSON.stringify({
            doi: finalDoi,
            registeredAt: new Date().toISOString(),
            events: publishEvents,
          }),
        },
      });

      if (article.correspondingAuthorId) {
        await db.notification.create({
          data: {
            userId: article.correspondingAuthorId,
            type: "SUCCESS",
            title: "Article Published",
            message: `"${article.title}" is now live. DOI: ${finalDoi}. Production events: ${publishEvents.join(" · ")}`,
            articleId,
          },
        });
      }

      // --- PREMIUM: Index article for semantic search + RAG chat + WS broadcast ---
      Promise.all([
        import("@/lib/embeddings").then(({ indexArticle }) => indexArticle(articleId).catch(() => {})),
        import("@/lib/chunk-embeddings").then(({ indexArticleChunks }) => indexArticleChunks(articleId).catch(() => {})),
        import("@/lib/ws-client").then(({ emitWS }) => emitWS("workflow:transition", {
          articleId, from: article.status, to: next, doi: finalDoi, title: article.title,
        }).catch(() => {})),
      ]).catch(() => {});

      // Accessibility: auto-generate alt-text suggestions for every figure
      // in the just-generated galley HTML, rather than leaving it purely
      // editor-discretionary (previously nothing ever ran this unless an
      // editor remembered to trigger it manually from the Manuscript
      // Checks panel). Suggestions are never auto-applied — see
      // src/lib/alt-text.ts — an editor still reviews and applies them
      // there; this only ensures suggestions exist to review by default.
      db.article.findUnique({ where: { id: articleId }, select: { galleyHtmlKey: true } })
        .then((a) => {
          if (!a?.galleyHtmlKey) return;
          return db.altTextJob.create({ data: { articleId, status: "QUEUED" } }).then((job) =>
            import("@/lib/alt-text").then(({ runAltTextJob }) => runAltTextJob(job.id, null, { status: "QUEUED" }))
          );
        })
        .catch((e) => console.error(`[workflow] auto alt-text job failed for ${articleId}:`, e));

      // Review report DOI — only meaningful when transparency was already
      // turned on before this publish. An editor who enables it afterward
      // uses the manual retry (POST /api/articles/[id]/review-report-doi).
      if (article.anonymizedReviewHistory) {
        import("@/lib/zenodo")
          .then(({ depositReviewReportToZenodo }) => depositReviewReportToZenodo(articleId))
          .catch((e) => console.error(`[workflow] review report deposit failed for ${articleId}:`, e));
      }
    } else if (next === "ACCEPTED" && article.correspondingAuthorId) {
      // Generate APC invoice on acceptance
      await db.invoice.create({
        data: {
          userId: article.correspondingAuthorId,
          articleId,
          type: "APC",
          amount: APC_USD,
          currency: "USD",
          status: "OPEN",
        },
      });
      await db.notification.create({
        data: {
          userId: article.correspondingAuthorId,
          type: "INFO",
          title: "Article Accepted — APC Invoice Issued",
          message: `Your article "${article.title}" has been accepted. An Article Processing Charge invoice for USD ${APC_USD.toFixed(2)} has been issued. Production will commence upon payment confirmation.`,
          articleId,
        },
      });
    }

    return NextResponse.json({
      article: { id: updated.id, status: updated.status, doi: finalDoi },
      decisionId: decisionRow.id,
    });
  } catch (e) {
    console.error("[workflow]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Production: generate galleys via the in-process Pandoc+WeasyPrint service.
// See src/lib/galley-regenerate.ts for generateGalleysForArticle() — shared
// with scripts/backfill-galleys.ts so both paths use identical logic.

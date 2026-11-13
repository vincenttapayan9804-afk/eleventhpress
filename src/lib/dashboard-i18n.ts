import type { Locale } from "./store";

/**
 * Dashboard navigation in each supported language: section names and
 * group headings, keyed by their English text (dashboard-tabs.ts). Used by
 * the sidebar, the phone sections sheet and the ⌘K palette. Unlisted text
 * falls back to English.
 */
const T: Record<Exclude<Locale, "en">, Record<string, string>> = {
  es: {
    Home: "Inicio", "Publishing — My Work": "Publicación — Mi trabajo", "Account & Access": "Cuenta y acceso",
    "Research Compliance": "Cumplimiento de la investigación", "Editorial Operations": "Operaciones editoriales",
    "Content Channels": "Canales de contenido", "Analytics & Reporting": "Analítica e informes",
    "Executive Command Intelligence": "Inteligencia ejecutiva", "Institution Administration": "Administración institucional",
    "Platform Administration": "Administración de la plataforma", Pinned: "Fijados",
    Overview: "Resumen", Library: "Biblioteca", "Second Brain": "Segundo cerebro", Profile: "Perfil",
    "Professional Dashboard": "Panel profesional", "New submission": "Nuevo envío", "My articles": "Mis artículos",
    "Article analytics": "Analítica de artículos", "My books": "Mis libros", "Article distribution": "Distribución de artículos",
    "My reviews": "Mis revisiones", Certificates: "Certificados", "Eleventh Research Lab": "Eleventh Research Lab",
    "Research Lab activity": "Actividad del Research Lab", "Billing & invoices": "Facturación y facturas", Subscription: "Suscripción",
    "Role application": "Solicitud de rol", "Ethics & COI": "Ética y conflictos de interés", "My grants": "Mis subvenciones",
    "Editorial queue": "Cola editorial", "Indexing & discovery": "Indexación y descubrimiento", "Book acquisitions": "Adquisición de libros",
    "Research integrity": "Integridad de la investigación", Magazines: "Revistas", Podcasts: "Pódcasts", "Media (News/Blog)": "Medios (noticias/blog)",
    Narration: "Narración", "COUNTER 5 / SUSHI": "COUNTER 5 / SUSHI", Institutions: "Instituciones", "Research dashboard": "Panel de investigación",
    "Institutional rankings": "Clasificaciones institucionales", "Research benchmarking": "Comparativa de investigación",
    "Board-level intelligence": "Inteligencia para la junta", "Reputation intelligence": "Inteligencia de reputación",
    "Reviewer marketplace": "Mercado de revisores", "Research board": "Junta de investigación", Departments: "Departamentos",
    "Ethics review": "Revisión ética", Grants: "Subvenciones", "Branding & profile": "Marca y perfil", "Team & access": "Equipo y acceso",
    Branding: "Marca", Tenants: "Inquilinos", "Admin & audit": "Administración y auditoría",
  },
  fr: {
    Home: "Accueil", "Publishing — My Work": "Publication — Mon travail", "Account & Access": "Compte et accès",
    "Research Compliance": "Conformité de la recherche", "Editorial Operations": "Opérations éditoriales",
    "Content Channels": "Canaux de contenu", "Analytics & Reporting": "Analyses et rapports",
    "Executive Command Intelligence": "Pilotage stratégique", "Institution Administration": "Administration de l’établissement",
    "Platform Administration": "Administration de la plateforme", Pinned: "Épinglés",
    Overview: "Vue d’ensemble", Library: "Bibliothèque", "Second Brain": "Second cerveau", Profile: "Profil",
    "Professional Dashboard": "Tableau de bord professionnel", "New submission": "Nouvelle soumission", "My articles": "Mes articles",
    "Article analytics": "Statistiques des articles", "My books": "Mes livres", "Article distribution": "Diffusion des articles",
    "My reviews": "Mes évaluations", Certificates: "Certificats", "Eleventh Research Lab": "Eleventh Research Lab",
    "Research Lab activity": "Activité du Research Lab", "Billing & invoices": "Facturation et factures", Subscription: "Abonnement",
    "Role application": "Demande de rôle", "Ethics & COI": "Éthique et conflits d’intérêts", "My grants": "Mes financements",
    "Editorial queue": "File éditoriale", "Indexing & discovery": "Indexation et découverte", "Book acquisitions": "Acquisitions de livres",
    "Research integrity": "Intégrité scientifique", Magazines: "Magazines", Podcasts: "Podcasts", "Media (News/Blog)": "Médias (actualités/blog)",
    Narration: "Narration", "COUNTER 5 / SUSHI": "COUNTER 5 / SUSHI", Institutions: "Établissements", "Research dashboard": "Tableau de bord de la recherche",
    "Institutional rankings": "Classements des établissements", "Research benchmarking": "Analyse comparative de la recherche",
    "Board-level intelligence": "Synthèse pour la direction", "Reputation intelligence": "Veille de réputation",
    "Reviewer marketplace": "Place de marché des évaluateurs", "Research board": "Conseil de la recherche", Departments: "Départements",
    "Ethics review": "Examen éthique", Grants: "Financements", "Branding & profile": "Identité et profil", "Team & access": "Équipe et accès",
    Branding: "Identité visuelle", Tenants: "Établissements clients", "Admin & audit": "Administration et audit",
  },
  fil: {
    Home: "Home", "Publishing — My Work": "Paglalathala — Aking gawa", "Account & Access": "Account at access",
    "Research Compliance": "Pagsunod sa pananaliksik", "Editorial Operations": "Gawaing editoryal",
    "Content Channels": "Mga channel ng nilalaman", "Analytics & Reporting": "Analytics at ulat",
    "Executive Command Intelligence": "Intelihensiya para sa pamunuan", "Institution Administration": "Pangangasiwa ng institusyon",
    "Platform Administration": "Pangangasiwa ng platform", Pinned: "Naka-pin",
    Overview: "Pangkalahatang-ideya", Library: "Aklatan", "Second Brain": "Second Brain", Profile: "Profile",
    "Professional Dashboard": "Propesyonal na dashboard", "New submission": "Bagong isusumite", "My articles": "Aking mga artikulo",
    "Article analytics": "Analytics ng artikulo", "My books": "Aking mga aklat", "Article distribution": "Pamamahagi ng artikulo",
    "My reviews": "Aking mga review", Certificates: "Mga sertipiko", "Eleventh Research Lab": "Eleventh Research Lab",
    "Research Lab activity": "Aktibidad sa Research Lab", "Billing & invoices": "Singil at invoice", Subscription: "Subscription",
    "Role application": "Aplikasyon sa tungkulin", "Ethics & COI": "Etika at COI", "My grants": "Aking mga grant",
    "Editorial queue": "Pila ng editoryal", "Indexing & discovery": "Pag-index at pagtuklas", "Book acquisitions": "Pagkuha ng aklat",
    "Research integrity": "Integridad ng pananaliksik", Magazines: "Mga magasin", Podcasts: "Mga podcast", "Media (News/Blog)": "Media (balita/blog)",
    Narration: "Narasyon", "COUNTER 5 / SUSHI": "COUNTER 5 / SUSHI", Institutions: "Mga institusyon", "Research dashboard": "Dashboard ng pananaliksik",
    "Institutional rankings": "Ranggo ng institusyon", "Research benchmarking": "Paghahambing ng pananaliksik",
    "Board-level intelligence": "Ulat para sa lupon", "Reputation intelligence": "Intelihensiya sa reputasyon",
    "Reviewer marketplace": "Marketplace ng reviewer", "Research board": "Lupon ng pananaliksik", Departments: "Mga departamento",
    "Ethics review": "Pagsusuring etikal", Grants: "Mga grant", "Branding & profile": "Branding at profile", "Team & access": "Koponan at access",
    Branding: "Branding", Tenants: "Mga tenant", "Admin & audit": "Admin at audit",
  },
  "zh-Hans": {
    Home: "主页", "Publishing — My Work": "出版 — 我的工作", "Account & Access": "账户与访问",
    "Research Compliance": "科研合规", "Editorial Operations": "编辑运营", "Content Channels": "内容渠道",
    "Analytics & Reporting": "分析与报告", "Executive Command Intelligence": "管理层情报", "Institution Administration": "机构管理",
    "Platform Administration": "平台管理", Pinned: "已固定",
    Overview: "概览", Library: "书库", "Second Brain": "第二大脑", Profile: "个人资料", "Professional Dashboard": "专业面板",
    "New submission": "新投稿", "My articles": "我的文章", "Article analytics": "文章分析", "My books": "我的图书",
    "Article distribution": "文章分发", "My reviews": "我的审稿", Certificates: "证书", "Eleventh Research Lab": "Eleventh 研究实验室",
    "Research Lab activity": "研究实验室动态", "Billing & invoices": "账单与发票", Subscription: "订阅", "Role application": "角色申请",
    "Ethics & COI": "伦理与利益冲突", "My grants": "我的资助", "Editorial queue": "编辑队列", "Indexing & discovery": "索引与发现",
    "Book acquisitions": "图书采编", "Research integrity": "科研诚信", Magazines: "杂志", Podcasts: "播客", "Media (News/Blog)": "媒体（新闻/博客）",
    Narration: "朗读", "COUNTER 5 / SUSHI": "COUNTER 5 / SUSHI", Institutions: "机构", "Research dashboard": "科研面板",
    "Institutional rankings": "机构排名", "Research benchmarking": "科研对标", "Board-level intelligence": "董事会情报",
    "Reputation intelligence": "声誉情报", "Reviewer marketplace": "审稿人市场", "Research board": "研究委员会", Departments: "院系",
    "Ethics review": "伦理审查", Grants: "资助", "Branding & profile": "品牌与资料", "Team & access": "团队与权限",
    Branding: "品牌", Tenants: "租户", "Admin & audit": "管理与审计",
  },
};

export function trDashboard(text: string, locale: Locale | undefined): string {
  if (!locale || locale === "en") return text;
  return T[locale]?.[text] ?? text;
}

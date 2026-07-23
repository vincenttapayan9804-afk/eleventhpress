/**
 * jstat ships no type declarations and none exist on the npm @types
 * registry — this covers only the distribution CDFs src/lib/statcheck.ts
 * actually calls.
 */
declare module "jstat" {
  interface Distribution {
    cdf(x: number, ...params: number[]): number;
  }

  interface JStatStatic {
    studentt: Distribution;
    centralF: Distribution;
    chisquare: Distribution;
    normal: Distribution;
  }

  const jStat: JStatStatic;
  export default jStat;
}

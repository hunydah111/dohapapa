// Node 24 내장 모듈 node:sqlite — 아직 @types/node 미수록이라 사용분만 최소 선언.
// (build-snapshot.ts 가 로컬 dev.db 백업에서 단지·거래를 읽을 때만 사용.)
declare module "node:sqlite" {
  interface StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

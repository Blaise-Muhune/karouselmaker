/**
 * Type declaration for optional "sharp" dependency.
 * When the package is not installed, the runtime will catch the failed import and fall back to no processing.
 */
declare module "sharp" {
  interface SharpInstance {
    resize(w: number, h: number, opts: unknown): SharpInstance;
    jpeg(opts: { quality: number }): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }
  function sharp(input: Buffer, opts?: { failOnError?: boolean }): SharpInstance;
  export default sharp;
}

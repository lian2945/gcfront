declare module 'json-bigint' {
  type ParseOptions = {
    storeAsString?: boolean;
    strict?: boolean;
  };

  interface JSONBigInt {
    parse(text: string): any;
    stringify(value: any): string;
  }

  function JSONBigInt(options?: ParseOptions): JSONBigInt;

  export default JSONBigInt;
}

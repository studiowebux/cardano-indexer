export const replacer = (_key: unknown, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

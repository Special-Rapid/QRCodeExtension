// locked Expo flat-configの公開配列APIだけを型付けする。runtime検証は追加しない。
declare module "eslint-config-expo/flat" {
  const config: import("eslint").Linter.Config[];
  export = config;
}

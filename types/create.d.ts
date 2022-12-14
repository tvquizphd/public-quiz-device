import type { Git } from "./util/types.js";
interface ToAppInput {
    code: string;
}
declare type AppStrings = {
    client_id: string;
    client_secret: string;
};
declare type JWK = {
    kty: 'RSA';
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
};
export declare type AppOutput = AppStrings & {
    id: string;
    jwk: JWK;
};
interface ToApp {
    (i: ToAppInput): Promise<AppOutput>;
}
declare type HasToken = {
    token: string;
};
export declare type Installed = HasToken & {
    expiration: string;
};
export declare type UserInstallRaw = {
    id: number;
    permissions: Record<string, string>;
};
export declare type UserInstall = UserInstallRaw & {
    git: Git;
    app: AppOutput;
};
interface ToInstall {
    (i: UserInstall): Promise<Installed>;
}
declare function isJWK(o: JsonWebKey): o is JWK;
declare const toPEM: (key: JWK) => string;
declare const toApp: ToApp;
declare const toInstall: ToInstall;
declare const toSign: (app: AppOutput) => string;
export { toPEM, isJWK, toSign, toApp, toInstall };

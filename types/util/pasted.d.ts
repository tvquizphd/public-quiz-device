import type { TreeAny, NodeAny } from "project-sock";
import type { UserInstall } from "../create.js";
import type { AppOutput } from "../create.js";
import type { Secrets } from "./encrypt.js";
import type { Git } from "./types.js";
export declare type HasGit = {
    git: Git;
};
export declare type WikiConfig = {
    home: string;
    tmp: string;
};
export declare type UserIn = HasGit & {
    delay: number;
    prod: boolean;
    wiki_config: WikiConfig;
};
declare type InstallIn = HasGit & {
    delay: number;
    app: AppOutput;
};
declare type ItemInC = {
    "body": Uint8Array;
    "mac_tag": Uint8Array;
};
declare type ServerAuthData = {
    As: Uint8Array;
    Xs: Uint8Array;
    beta: Uint8Array;
    c: Record<"pu" | "Pu" | "Ps", ItemInC>;
};
export declare type Pasted = {
    C: Secrets;
    S?: ServerAuthData;
};
export declare type UserApp = Pasted & {
    S: ServerAuthData;
};
interface ReadUserInstall {
    (u: InstallIn): Promise<UserInstall>;
}
interface ReadUserApp {
    (u: UserIn): Promise<UserApp>;
}
declare type Tries = {
    max_tries: number;
    dt: number;
};
interface ToTries {
    (u: number): Tries;
}
interface ToPasted {
    (s: string): Promise<string>;
}
declare type GitOutput = {
    repo_url: string;
    tmp_dir: string;
    tmp_file: string;
};
interface UseGit {
    (i: UserIn): GitOutput;
}
export declare function isTree(u: NodeAny): u is TreeAny;
declare const useGit: UseGit;
declare const toPasted: ToPasted;
declare const toTries: ToTries;
declare const readUserApp: ReadUserApp;
declare const readUserInstall: ReadUserInstall;
export { readUserApp, readUserInstall, toTries, toPasted, useGit };

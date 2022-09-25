import { ProjectChannel } from "project-sock";
import type { Namespace } from "../config/sock";
import type { Git } from "./types";
export declare type Socket = {
    sock: ProjectChannel;
    get: (id: string, tag: string) => Promise<unknown>;
    give: (id: string, tag: string, msg: any) => void;
};
export declare type SockInputs = {
    namespace: Namespace;
    delay: number;
    git: Git;
};
interface ToSock {
    (inputs: SockInputs, key: string): Promise<Socket>;
}
declare const toSock: ToSock;
export { toSock };

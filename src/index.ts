import { isLoginStart, isLoginEnd, isTree } from "./util/pasted.js";
import { readLoginStart, readLoginEnd, toNameTree } from "./util/pasted.js";
import { readUserApp, readUserInstall } from "./util/pasted.js";
import { fromB64urlQuery, toB64urlQuery } from "project-sock";
import { addSecret, isProduction } from "./util/secrets.js";
import { vStart, vLogin } from "./verify.js";
import { toSyncOp } from "./verify.js";
import { encryptSecrets } from "./util/encrypt.js";
import { decryptQuery } from "./util/decrypt.js";
import { isQuad, isTrio, isDuo } from "./util/types.js";
import { isJWK, toApp, toInstall } from "./create.js";
import { getRandomValues } from "crypto";
import dotenv from "dotenv";
import argon2 from 'argon2';
import fs from "fs";

import type { AppOutput } from "./create.js";
import type { TreeAny } from "project-sock"
import type { WikiConfig } from "./util/pasted.js";
import type { ClientOut, NewClientOut } from "opaque-low-io";
import type { ServerFinal } from "opaque-low-io";
import type { Trio } from "./util/types.js";

type Env = Record<string, string | undefined>;
type Result = {
  success: boolean,
  message: string
}
type SecretOutputs = {
  for_pages: string,
  for_next: string,
}
interface WriteSecretText {
  (i: Partial<SecretOutputs>): void;
}
type MayReset = {
  OLD_HASH: string,
  SESSION: string
}
type ClientState = {
  r: Uint8Array,
  xu: Uint8Array,
  mask: Uint8Array,
}
type ClientAuthResult = ClientOut["client_auth_result"];
type ClientSecretOut = {
  token: string,
  client_auth_result: ClientAuthResult
};
type TokenIn = {
  app: AppOutput
  shared: string
};

function isNumber(u: unknown): u is number {
  return typeof u === "number";
}

function isServerFinal(o: TreeAny): o is ServerFinal {
  const needs = [
    o.Au instanceof Uint8Array,
    typeof o.token === "string"
  ];
  return needs.every(v => v);
}

function isClientState (o: TreeAny): o is ClientState {
  const needs = [
    o.r instanceof Uint8Array,
    o.xu instanceof Uint8Array,
    o.mask instanceof Uint8Array
  ]
  return needs.every(v => v);
}

function isTokenInputs (o: TreeAny): o is TokenIn {
  if (!isTree(o.app)) {
    return false;
  }
  if (!isTree(o.app.jwk)) {
    return false;
  }
  const needs = [ 
    typeof o.shared === "string",
    typeof o.app.client_secret === "string",
    typeof o.app.client_id === "string",
    typeof o.app.id === "string",
    isJWK(o.app.jwk)
  ];
  return needs.every(v => v);
}

const canReset = async (inputs: MayReset) => {
  const { OLD_HASH, SESSION } = inputs;
  if (!OLD_HASH || !SESSION) {
    return false;
  }
  return await argon2.verify(OLD_HASH, SESSION);
}

function mayReset(env: Env): env is MayReset {
  const vars = [env.OLD_HASH, env.SESSION];
  return vars.every(s => typeof s === "string" && s.length > 0);
} 

const toNewPassword = () => {
  const empty = new Uint8Array(3*23);
  const bytes = [...getRandomValues(empty)];
  return (Buffer.from(bytes)).toString('base64');
}

const writeSecretText: WriteSecretText = (inputs) => {
  const out_file = "secret.txt";
  const a = inputs?.for_pages || "";
  const b = inputs?.for_next || "";
  fs.writeFileSync(out_file, `${a}\n${b}`);
  console.log(`Wrote to ${out_file}.`);
}

const toNew = (opts: NewClientOut) => {
  const { client_auth_data, ...rest } = opts;
  const pub_obj = { client_auth_data };
  return {
    for_pages: toB64urlQuery(pub_obj),
    for_next: toB64urlQuery(rest)
  }
}

const useSecrets = (out: ClientSecretOut, app: AppOutput) => {
  const { token: shared, client_auth_result } = out;
  const pub_obj = { client_auth_result };
  const next_obj = { 
    shared: shared,
    app: {
      id: app.id,
      jwk: app.jwk,
      client_id: app.client_id,
      client_secret: app.client_secret
    },
  };
  return {
    for_pages: toB64urlQuery(pub_obj),
    for_next: toB64urlQuery(next_obj)
  }
}

(async (): Promise<Result> => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Missing 1st arg: MY_TOKEN";
    return { success: false, message };
  }
  const ses = "SESSION"
  const pep = "ROOT_PEPPER";
  const inst = "INSTALLATION";
  const sec: Trio = [ "SERVERS", "CLIENTS", "SECRETS" ];
  const env_all = [ses, pep, inst, "STATE", ...sec];
  const remote = process.env.REMOTE?.split("/") || [];
  const env = process.env.DEPLOYMENT || "";
  const prod = isProduction(env);
  if (!isDuo(remote)) {
    const message = "Invalid env: REMOTE";
    return { success: false, message };
  }
  if (env.length < 1) {
    const message = "Invalid env: DEPLOYMENT";
    return { success: false, message };
  }
  if (!isQuad(args) && !isTrio(args) && !isDuo(args)) {
    const message = "2 to 4 arguments required";
    return { success: false, message };
  }
  const git = {
    repo: remote[1],
    owner: remote[0],
    owner_token: "",
  }
  const wiki_config: WikiConfig = {
    home: "Home.md",
    tmp: "tmp-wiki"
  }
  const delay = 2; // 2 sec
  if (!prod) {
    console.log('DEVELOPMENT\n');
    dotenv.config();
  }
  else {
    console.log('PRODUCTION\n');
  }
  const v_in = { git, env, delay };
  const login = isQuad(args) && args[0] === "LOGIN";
  const setup = isTrio(args) && args[0] === "SETUP";
  const dev = isDuo(args) && args[0] === "DEV";
  const log_in = { ...v_in, pep, login, reset: false };
  const user_in = { git, prod, delay, wiki_config };
  if (dev) {
    try {
      if (args[1] === "OPEN") {
        await readLoginStart(user_in);
      }
      else if (args[1] === "CLOSE") {
        await readLoginEnd(user_in);
      }
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to verify";
      return { success: false, message };
    }
  }
  else if (login) {
    const commands = {
      OPEN: "op:pake__client_auth_data",
      FINISH: "op:pake__server_auth_data",
      CLOSE: "op:pake__client_auth_result"
    }
    try {
      if (mayReset(process.env)) {
        log_in.reset = await canReset(process.env);
      }
      const work_in = args[3];
      const secret_in = args[2];
      const { command, tree } = toNameTree(work_in);
      const given = fromB64urlQuery(secret_in);
      if (args[1] === "OPEN") {
        if (!tree.client_auth_data) {
          throw new Error('No workflow inputs.');
        }
        if (!isLoginStart(tree.client_auth_data)) {
          throw new Error('Invalid workflow inputs.');
        }
        if (command !== commands.OPEN) {
          throw new Error('Invalid workflow command.');
        }
        const { sid, pw } = tree.client_auth_data;
        const finish = commands.FINISH;
        const start_in = {
          sid, pw, log_in, user_in, finish, command, tree 
        };
        const started = await vStart(start_in);
        const { for_next, for_pages } = started;
        writeSecretText({ for_pages, for_next });
        console.log('Began to verify user.\n');
      }
      else if (args[1] === "CLOSE") {
        if (!tree.client_auth_result) {
          throw new Error('No workflow inputs.');
        }
        if (!isLoginEnd(tree.client_auth_result)) {
          throw new Error('Invalid workflow inputs.');
        }
        if (!isServerFinal(given)) {
          throw new Error('Invalid server inputs.');
        }
        if (command !== commands.CLOSE) {
          throw new Error('Invalid workflow command.');
        }
        const end_in = { 
          ...given, log_in, user_in, command, tree, sec, ses
        };
        const payload = await vLogin(end_in);
        const { for_next, for_pages } = payload;
        writeSecretText({ for_pages, for_next });
        console.log('Verified user.\n');
      }
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to verify";
      return { success: false, message };
    }
  }
  else if (setup) {
    const user_id = "root";
    const Opaque = await toSyncOp();
    const { toNewClientAuth, toClientSecret } = Opaque;
    if (args[1] === "PUB") {
      const password = toNewPassword();
      const client_in = { user_id, password };
      console.log(`Creating new secure public channel.`);
      try {
        const new_client = toNewClientAuth(client_in);
        console.log("Created secure public channel.\n");
        writeSecretText(toNew(new_client));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Error making secure public channel.";
        return { success: false, message };
      }
    }
    const times = 1000;
    const secret_in = args[2];
    const given = fromB64urlQuery(secret_in);
    if (args[1] === "APP") {
      if (!isClientState(given)) {
        const message = "Can't create App.";
        return { success: false, message };
      }
      console.log(`Creating GitHub App.`);
      const { r, xu, mask } = given;
      try {
        const user_out = await readUserApp(user_in);
        const { C, S: server_auth_data } = user_out;
        const client_in = { r, xu, mask, server_auth_data };
        const secret_out = toClientSecret(client_in, times);
        if (isNumber(secret_out)) {
          const msg = `Opaque error code: ${secret_out}`;
          throw new Error(`Error Making App. ${msg}`);
        }
        const shared = secret_out.token;
        const c = decryptQuery(toB64urlQuery(C), shared);
        const code = (await c).plain_text;
        const app_out = await toApp({ code });
        console.log("Created GitHub App.\n");
        writeSecretText(useSecrets(secret_out, app_out));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub App.";
        return { success: false, message };
      }
    }
    if (args[1] === "TOKEN") {
      if (!isTokenInputs(given)) {
        const message = "Can't create Token.";
        return { success: false, message };
      }
      console.log(`Creating GitHub Token.`);
      const { shared, app } = given;
      try {
        const install_in = { git, app, delay };
        const install = await readUserInstall(install_in);
        const installed = await toInstall(install);
        const new_git = {
          repo: git.repo,
          owner: git.owner,
          owner_token: installed.token
        }
        const secret = toB64urlQuery({
          installed, shared, app
        });
        await addSecret({ git, env, secret, name: inst });
        const for_pages = toB64urlQuery(await encryptSecrets({
          secret_text: installed.token,
          password: shared
        }));
        const for_next = toB64urlQuery({ git: new_git });
        console.log("Created GitHub Token.\n");
        writeSecretText({ for_pages, for_next });
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub Token.";
        return { success: false, message };
      }
    }
  }
  if (!prod) {
    const env_vars = env_all.filter((v) => {
      return process.env[v];
    });
    const new_env = env_vars.map((v) => {
      // set in non-production addSecret call
      return `${v}="${process.env[v]}"`;
    }).join('\n');
    try {
      fs.writeFileSync('.env', new_env);
      console.log('Wrote new .env file.');
    } catch (e: any) {
      console.error(e?.message);
    }
  }
  const message = "Action complete!\n";
  return { success: true, message };
})().then((result: Result) => {
  if (result.success) {
    return console.log(result.message);
  }
  return console.error(result.message);
}).catch((e: any) => {
  console.error("Unexpected Error Occured");
  console.error(e?.message);
});

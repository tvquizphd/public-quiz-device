import { configureNamespace } from "./config/sock";
import { decryptQueryMaster } from "./util/decrypt";
import { toB64urlQuery } from "project-sock";
import { addSecret } from "./util/secrets";
import { needKeys } from "./util/keys";
import { toSock } from "./util/socket";
import { findSub } from "./util/lookup";
import { opId } from "./util/lookup";

import type { Git, Trio } from "./util/types";
import type { Encrypted } from "./util/encrypt";

type HasPlain = Record<"plain_text", string>;
type HasSec = Record<"sec", Trio>;
type Inputs = HasSec & {
  session: string,
  delay: number,
  git: Git
}
type Secrets = Record<string, string>;
type SaveInputs = HasSec & {
  secrets: Secrets,
  git: Git
}
type Output = {
  secrets: Secrets,
  trio: Trio
}
interface WriteDB {
  (i: HasSec & HasPlain): Output;
}
interface Inbox {
  (i: Inputs): Promise<Output>
}

function isTrio(trio: string[]): trio is Trio {
  return trio.length === 3;
}

const write_database: WriteDB = ({ sec, plain_text }) => {
  const trio = plain_text.split('\n');
  if (!isTrio(trio)) {
    throw new Error('SECRET must be 3 lines');
  }
  const pairs = sec.map((k, i) => [k, trio[i]]);
  const secrets = Object.fromEntries(pairs);
  return { trio, secrets }
}

const saveSecrets = async (inputs: SaveInputs) => {
  const { git, sec, secrets } = inputs;
  try {
    needKeys(secrets, sec);
  }
  catch (e: any) {
    console.error(`Need ${sec.join(", ")}`);
    console.error(e?.message);
    return false;
  }
  const entries = Object.entries(secrets).filter(([name]) => {
    return sec.includes(name);
  })
  const promises = entries.map(([name, secret]) => {
    return new Promise((resolve, reject) => {
      addSecret({git, secret, name}).then(() => {
        resolve(null);
      }).catch((e) => {
        reject(e);
      });
    })
  }) 
  const info = "from last session";
  try {
    await Promise.all(promises);
    console.log(`Saved secrets ${info}`);
    return true;
  }
  catch (e: any) {
    console.error(`Can't save secrets ${info}`);
    console.error(e?.message);
    return false;
  }
}

const inbox: Inbox = async (inputs) => {
  const wait_extra_ms = 2000;
  const namespace = configureNamespace();
  const { git, sec, delay, session } = inputs;
  const dt = 1000 * delay + wait_extra_ms;
  const timeout = "timeout";
  // Check for existing saved secrets
  const load = findSub(namespace.mailbox, "to_secret");
  const sock_inputs = { git, delay, namespace };
  const Sock = await toSock(sock_inputs, "mailbox");
  const { project } = Sock.sock;
  const clean_up = () => {
    project.done = true;
    console.log('Closed inbox.')
  };
  const master_buffer = Buffer.from(session, "hex");
  const master_key = new Uint8Array(master_buffer);
  const promise = new Promise((resolve, reject) => {
    const { text, subcommand: sub } = load;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(namespace.mailbox, sub);
    Sock.get(op_id, sub).then(resolve).catch(reject);
  });
  try {
    const data = await promise as Encrypted;
    const search = toB64urlQuery({ data });
    const query_input = { master_key, search };
    const { plain_text } = decryptQueryMaster(query_input);
    const { secrets, trio } = write_database({ sec, plain_text });
    const done = await saveSecrets({ git, sec, secrets });
    clean_up();
    if (done) {
      console.log("\nImported secrets.");
      return { secrets, trio };
    }
  }
  catch (e: any) {
    if (e?.message != timeout) {
      console.error(e?.message);
    }
  }
  clean_up();
  const secrets: Secrets = {};
  const trio: Trio = ["", "", ""];
  console.log("\nNo new secrets.");
  return { secrets, trio };
}

export {
  inbox
}
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

import { safeExec, parseJsonTE } from "../utils";
import { CloudwatchLog, CloudwatchLogDecoder } from "../types";

export interface MonadAws {
  logGroups: () => TE.TaskEither<Error, string[]>;
  logStreams: (logGroupName: string) => TE.TaskEither<Error, string[]>;
  logEvents: (logGroupName: string, logStreamName: string) => TE.TaskEither<Error, CloudwatchLog>;
}

export const monadAws: MonadAws = {
  logGroups: () => pipe(
    safeExec("aws logs describe-log-groups --query logGroups[*].logGroupName"),
    TE.chain(parseJsonTE),
    TE.chain(v => pipe(
      TE.fromEither(t.array(t.string).decode(v)),
      TE.mapLeft(e => new Error("errors while parsing log groups"))
    ))
  ),
  logStreams: (groupName: string) => pipe(
    safeExec(`aws logs describe-log-streams --log-group-name ${groupName} --query logStreams[*].logStreamName --descending --limit 20`),
    TE.chain(parseJsonTE),
    TE.chain(v => pipe(
      TE.fromEither(t.array(t.string).decode(v)),
      TE.mapLeft(e => new Error("errors while parsing log streams"))
    ))
  ),
  logEvents: (groupName, streamName) => pipe(
    safeExec(`aws logs get-log-events --log-group-name '${groupName}' --log-stream-name '${streamName}' --limit 40`),
    TE.chain(parseJsonTE),
    TE.chain(v => pipe(
      TE.fromEither(CloudwatchLogDecoder.decode(v)),
      TE.mapLeft(e => new Error("errors while parsing logs"))
    ))
  )
};
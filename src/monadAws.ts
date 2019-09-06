import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";

import { safeExec, parseJsonTE } from "./utils";

export interface MonadAws {
  logGroups: () => TE.TaskEither<Error, string[]>;
  logStreams: (logGroupName: string) => TE.TaskEither<Error, string[]>;
  logEvents: (logGroupName: string, logStreamName: string) => TE.TaskEither<Error, string>;
}

const logGroups = () => pipe(
  safeExec("aws logs describe-log-groups --query logGroups[*].logGroupName"),
  TE.chain(v => parseJsonTE<string[]>(v)),
);

const logStreams = (groupName: string) => pipe(
  safeExec(`aws logs describe-log-streams --log-group-name ${groupName} --query logStreams[*].logStreamName`),
  TE.chain(v => parseJsonTE<string[]>(v))
);

const logEvents = (groupName: string, streamName: string) => pipe(
  safeExec(`aws logs get-log-events --log-group-name '${groupName}' --log-stream-name '${streamName}'`),
  TE.chain(v => parseJsonTE<string>(v))
);

export const monadAws: MonadAws = {
  logGroups,
  logStreams,
  logEvents
};
import * as t from "io-ts";

export type CloudwatchLog = t.TypeOf<typeof CloudwatchLogDecoder>;
export type CloudwatchLogEvent = t.TypeOf<typeof CloudwatchLogEventDecoder>;

const CloudwatchLogEventDecoder = t.type({
  ingestionTime: t.number,
  timestamp: t.number,
  message: t.string
});

export const CloudwatchLogDecoder = t.type({
  events: t.array(CloudwatchLogEventDecoder)
});
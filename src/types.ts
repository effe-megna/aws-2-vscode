import * as t from "io-ts";

export type CloudwatchLog = t.TypeOf<typeof CloudwatchLogDecoder>;
export type CloudwatchLogEvent = t.TypeOf<typeof CloudwatchLogEventDecoder>;
export type CloudwatchFilterLogResult = t.TypeOf<typeof FilterLogResultDecoder>;

const CloudwatchLogEventDecoder = t.type({
  ingestionTime: t.number,
  timestamp: t.number,
  message: t.string
});

export const CloudwatchLogDecoder = t.type({
  nextForwardToken: t.string,
  events: t.array(CloudwatchLogEventDecoder),
  nextBackwardToken: t.string
});

export const FilterLogResultDecoder = t.type({
  nextToken: t.union([t.string, t.null, t.undefined]),
  events: t.array(t.type({
    logStreamName: t.string,
    timestamp: t.number,
    message: t.string,
    ingestionTime: t.number,
    eventId: t.string
  }))
});
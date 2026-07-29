import { describe, it, expect } from "vitest";
import * as queries from "../queries";
import * as mutations from "../mutations";

describe("Apollo queries", () => {
  it("should export session queries", () => {
    expect(queries.GET_SESSIONS).toBeDefined();
    expect(queries.GET_SESSION_BY_ID).toBeDefined();
    expect(queries.GET_ACTIVE_SESSIONS).toBeDefined();
    expect(queries.GET_SESSION_COUNT).toBeDefined();
  });

  it("should export waveform queries", () => {
    expect(queries.GET_WAVEFORMS).toBeDefined();
    expect(queries.GET_WAVEFORM).toBeDefined();
    expect(queries.GET_RECENT_WAVEFORMS).toBeDefined();
    expect(queries.GET_WAVEFORM_STATISTICS).toBeDefined();
  });

  it("should export settings queries", () => {
    expect(queries.GET_SETTINGS).toBeDefined();
  });

  it("should export dashboard queries", () => {
    expect(queries.GET_DASHBOARD_SUMMARY).toBeDefined();
    expect(queries.GET_RECENT_SESSIONS).toBeDefined();
  });

  it("should export valid GraphQL document objects", () => {
    expect(queries.GET_SESSIONS.kind).toBe("Document");
    expect(queries.GET_WAVEFORMS.kind).toBe("Document");
    expect(queries.GET_DASHBOARD_SUMMARY.kind).toBe("Document");
  });
});

describe("Apollo mutations", () => {
  it("should export session mutations", () => {
    expect(mutations.START_SESSION).toBeDefined();
    expect(mutations.END_SESSION).toBeDefined();
    expect(mutations.DELETE_SESSION).toBeDefined();
    expect(mutations.CAPTURE_WAVEFORM).toBeDefined();
  });

  it("should export waveform mutations", () => {
    expect(mutations.CREATE_WAVEFORM).toBeDefined();
    expect(mutations.DELETE_WAVEFORMS).toBeDefined();
  });

  it("should export settings mutations", () => {
    expect(mutations.CREATE_SETTINGS).toBeDefined();
    expect(mutations.UPDATE_SETTINGS).toBeDefined();
    expect(mutations.DELETE_SETTINGS).toBeDefined();
  });

  it("should export valid GraphQL document objects", () => {
    expect(mutations.START_SESSION.kind).toBe("Document");
    expect(mutations.CREATE_WAVEFORM.kind).toBe("Document");
    expect(mutations.UPDATE_SETTINGS.kind).toBe("Document");
  });
});

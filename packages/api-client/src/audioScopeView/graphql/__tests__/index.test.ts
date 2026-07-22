import { describe, it, expect } from "vitest";
import * as queries from "../queries";
import * as mutations from "../mutations";

describe("Apollo queries", () => {
  it("should export scope queries", () => {
    expect(queries.GET_SCOPES).toBeDefined();
    expect(queries.GET_SCOPE).toBeDefined();
    expect(queries.GET_ACTIVE_SCOPES).toBeDefined();
    expect(queries.GET_SCOPE_COUNT).toBeDefined();
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
    expect(queries.GET_RECENT_SCOPES).toBeDefined();
  });

  it("should export valid GraphQL document objects", () => {
    expect(queries.GET_SCOPES.kind).toBe("Document");
    expect(queries.GET_WAVEFORMS.kind).toBe("Document");
    expect(queries.GET_DASHBOARD_SUMMARY.kind).toBe("Document");
  });
});

describe("Apollo mutations", () => {
  it("should export scope mutations", () => {
    expect(mutations.CREATE_SCOPE).toBeDefined();
    expect(mutations.UPDATE_SCOPE).toBeDefined();
    expect(mutations.DELETE_SCOPE).toBeDefined();
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
    expect(mutations.CREATE_SCOPE.kind).toBe("Document");
    expect(mutations.CREATE_WAVEFORM.kind).toBe("Document");
    expect(mutations.UPDATE_SETTINGS.kind).toBe("Document");
  });
});

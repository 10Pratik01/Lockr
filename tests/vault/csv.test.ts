import { describe, expect, it } from "vitest";
import { parseCsv, parseImport } from "@/lib/vault/csv";

const HEADER = "name,url,username,password,note";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines and CRLF", () => {
    const rows = parseCsv('a,"b,1","say ""hi""","line1\nline2"\r\nx,y,z,w\r\n');
    expect(rows).toEqual([
      ["a", "b,1", 'say "hi"', "line1\nline2"],
      ["x", "y", "z", "w"],
    ]);
  });

  it("strips a BOM and ignores blank lines", () => {
    expect(parseCsv("﻿a,b\n\n\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseImport", () => {
  it("imports a Chrome/Brave export row", () => {
    const { rows, fileError } = parseImport(
      `${HEADER}\naccess.broadcom.com,https://access.broadcom.com/signin,me@example.com,pw123456,`
    );
    expect(fileError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ready");
    expect(rows[0].data).toEqual({
      site: "access.broadcom.com",
      url: "https://access.broadcom.com/signin",
      username: "me@example.com",
      password: "pw123456",
      notes: "",
    });
  });

  it("rejects files that are not password exports", () => {
    expect(parseImport("a,b\n1,2").fileError).toBeTruthy();
    expect(parseImport("").fileError).toBeTruthy();
  });

  it("moves non-http(s) URLs into notes instead of storing them", () => {
    const { rows } = parseImport(`${HEADER}\nApp,android://abc@com.app,u,pw,`);
    expect(rows[0].status).toBe("ready");
    expect(rows[0].data?.url).toBe("");
    expect(rows[0].data?.notes).toContain("android://abc@com.app");
  });

  it("flags rows with no password and falls back to the host for a missing name", () => {
    const { rows } = parseImport(`${HEADER}\nNoPw,https://a.com,u,,\n,https://www.b.com/x,u,pw,`);
    expect(rows[0].status).toBe("invalid");
    expect(rows[1].data?.site).toBe("b.com");
  });

  it("skips duplicates within the file and against the existing vault", () => {
    const existing = [{ site: "A", url: "https://a.com/login", username: "U", password: "pw", notes: "" }];
    const { rows } = parseImport(
      `${HEADER}\nA,https://www.a.com,u,pw,\nB,https://b.com,u,pw,\nB again,https://b.com/other,u,pw,`,
      existing
    );
    expect(rows.map((r) => r.status)).toEqual(["duplicate", "ready", "duplicate"]);
  });
});

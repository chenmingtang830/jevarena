import {describe,it,expect} from "vitest";
import {readLoginForm} from "../lib/auth-request";
describe("login form bounds",()=>{
  it("reads a bounded form",async()=>{const form=await readLoginForm(new Request("https://example.test/auth/email",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"email=a%40example.test&policy=2026-09-19"}));expect(form.get("email")).toBe("a@example.test");});
  it("rejects oversized bodies without trusting length",async()=>{await expect(readLoginForm(new Request("https://example.test/auth/email",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"x".repeat(1025)}))).rejects.toThrow();});
  it("rejects wrong encoding and content type",async()=>{await expect(readLoginForm(new Request("https://example.test/auth/email",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}))).rejects.toThrow();});
});

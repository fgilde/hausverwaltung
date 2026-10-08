import { describe, it, expect } from "vitest";
import { pingenLetterBody, mapPingenStatus } from "./pingen";
import { splitAddress, epostLetterBody, mapEpostStatus } from "./epost";

describe("Pingen (#58)", () => {
  it("Brief-Body mit Optionen", () => {
    const b = pingenLetterBody({ url: "u", signature: "s", name: "Brief.pdf" }, { color: true, duplex: false, product: "fast" });
    expect(b.data.type).toBe("letters");
    expect(b.data.attributes).toMatchObject({
      file_original_name: "Brief.pdf", file_url: "u", file_url_signature: "s", address_position: "left",
      auto_send: true, delivery_product: "fast", print_mode: "simplex", print_spectrum: "color",
    });
    expect(pingenLetterBody({ url: "u", signature: "s", name: "x" }, {}).data.attributes).toMatchObject({
      delivery_product: "cheap", print_spectrum: "grayscale",
    });
  });
  it("Status", () => {
    expect(mapPingenStatus("validating")).toBe("EINGEREICHT");
    expect(mapPingenStatus("awaiting_credits")).toBe("EINGEREICHT");
    expect(mapPingenStatus("sent")).toBe("VERSENDET");
    expect(mapPingenStatus("delivered")).toBe("ZUGESTELLT");
    expect(mapPingenStatus("undeliverable")).toBe("FEHLER");
  });
});

describe("Deutsche Post E-POST (#58)", () => {
  it("zerlegt die Anschrift", () => {
    expect(splitAddress(["Anna Schneider", "c/o Weber", "Lindenweg 3", "12345 Musterstadt"])).toEqual({
      lines: ["Anna Schneider", "c/o Weber", "Lindenweg 3"], zip: "12345", city: "Musterstadt", country: "",
    });
    expect(splitAddress(["Max Muster", "Ring 1", "1010 Wien", "Österreich"])?.country).toBe("ÖSTERREICH");
    expect(splitAddress(["Max", "Ring 1", "12345 Ort", "Deutschland"])?.country).toBe("");
    expect(splitAddress(["Nur Name", "Straße 1"])).toBeNull();
  });
  it("Brief-Body", () => {
    const addr = splitAddress(["Anna Schneider", "Lindenweg 3", "12345 Musterstadt"])!;
    const [b] = epostLetterBody({ test: true }, Buffer.from("%PDF"), "Brief_1.pdf", addr, { duplex: true }, { testEmail: "a@b.de" });
    expect(b).toMatchObject({
      fileName: "Brief_1.pdf", data: Buffer.from("%PDF").toString("base64"), isColor: false, isDuplex: true,
      registeredLetter: null, testFlag: true, testEMail: "a@b.de", addressLine1: "Anna Schneider",
      addressLine2: "Lindenweg 3", zipCode: "12345", city: "Musterstadt", country: "",
    });
    const [live] = epostLetterBody({ test: false }, Buffer.from(""), "f.pdf", addr, {}, { testEmail: "a@b.de" });
    expect(live).not.toHaveProperty("testEMail");
  });
  it("Status", () => {
    expect(mapEpostStatus(1)).toBe("EINGEREICHT");
    expect(mapEpostStatus(4)).toBe("VERSENDET");
    expect(mapEpostStatus(99)).toBe("FEHLER");
  });
});

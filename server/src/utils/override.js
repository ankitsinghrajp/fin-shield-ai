/**
 * Override layer — corrects / normalises PII type labels post-detection.
 * Runs on both structured and unstructured paths.
 */
export const applyOverrides = (taggedData) => {
  return taggedData.map((record) => {
    const pii = { ...(record.__pii || {}) };

    for (const key of Object.keys(pii)) {
      const k = key.toLowerCase();

      if (k.includes("aadhaar"))  pii[key] = "aadhaar";
      else if (k.includes("pan") && !k.includes("company")) pii[key] = "pan";
      else if (k.includes("phone") || k.includes("mobile")) pii[key] = "phone";
      else if (k.includes("email") || k.includes("mail"))   pii[key] = "email";
      else if (k.includes("account") || k.includes("acc"))  pii[key] = "account";
      else if (k.includes("card") || k.includes("credit"))  pii[key] = "creditcard";
      else if (k.includes("ip") && k.length <= 8)           pii[key] = "ip";
    }

    return { ...record, __pii: pii };
  });
};
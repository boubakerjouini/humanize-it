// Jest transform for @react-email/render's CommonJS build only. Its render()
// loads react-dom/server with a native import(), which jest's CommonJS module
// runtime rejects ("A dynamic import callback was invoked without
// --experimental-vm-modules"). Rewriting the literal import("x") calls to a
// lazy require keeps email template tests rendering real HTML.
module.exports = {
  process(sourceText) {
    return {
      code: sourceText.replace(/\bimport\((["'][^"'()]+["'])\)/g, "Promise.resolve().then(() => require($1))"),
    };
  },
};

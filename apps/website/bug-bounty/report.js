"use strict";

(() => {
  const { SimplePool, generateSecretKey, getEventHash, nip17, nip59 } = window.NostrTools;

  const SATSIGNER_PUBKEY = "6dd3b72e325da7383b275eef1c66131ba4664326e162bc060527509b4e33ae43";
  const DISCOVERY_RELAYS = ["wss://purplepag.es", "wss://relay.damus.io", "wss://nos.lol"];
  const FALLBACK_INBOX_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
  const DM_RELAYS_KIND = 10050;
  const PRIVATE_DM_KIND = 14;
  const SEAL_KIND = 13;
  const RELAY_LOOKUP_TIMEOUT_MS = 4000;
  // NIP-44 caps plaintext at 65535 bytes and the seal is encrypted again inside the wrap.
  // 40000 bytes of JSON-escaped content keeps the padded rumor at 40960 bytes, so the seal stays under the cap.
  const MAX_REPORT_BYTES = 40000;
  const CONNECTION_FAILURE_PREFIX = "connection failure";
  const TWO_DAYS_S = 2 * 24 * 60 * 60;

  const form = document.getElementById("report-form");
  const reportInput = document.getElementById("report");
  const anonymousButton = document.getElementById("send-anonymous");
  const signedButton = document.getElementById("send-signed");
  const status = document.getElementById("report-status");

  const pool = new SimplePool();

  const supportsSignedReports = () => Boolean(window.nostr?.nip44?.encrypt);

  const nowSeconds =() => Math.round(Date.now() / 1000);

  // NIP-59: seal timestamps are randomised up to two days back to hide when the message was written.
  const randomPastSeconds = () => nowSeconds() - Math.floor(Math.random() * TWO_DAYS_S);

  const setStatus = (text, tone) => {
    status.textContent = text;
    status.dataset.tone = tone || "";
  };

  const sendState = { active: false };

  const refreshButtons = () => {
    anonymousButton.disabled = sendState.active;
    signedButton.disabled = sendState.active || !supportsSignedReports();
    signedButton.title = supportsSignedReports() ? "" : "Install a Nostr extension with NIP-44 support";
  };

  const setBusy = (busy) => {
    sendState.active = busy;
    reportInput.readOnly = busy;
    refreshButtons();
  };

  const isRelayUrl = (url) => typeof url === "string" && url.startsWith("wss://");

  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

  const getInboxRelays = async () => {
    const event = await withTimeout(
      pool.get(DISCOVERY_RELAYS, { kinds: [DM_RELAYS_KIND], authors: [SATSIGNER_PUBKEY] }),
      RELAY_LOOKUP_TIMEOUT_MS,
    );
    const relays = (event?.tags || [])
      .filter((tag) => tag[0] === "relay" && isRelayUrl(tag[1]))
      .map((tag) => tag[1]);
    return relays.length > 0 ? relays : FALLBACK_INBOX_RELAYS;
  };

  const buildAnonymousWrap = (content) =>
    nip17.wrapEvent(generateSecretKey(), { publicKey: SATSIGNER_PUBKEY }, content);

  const buildSignedWrap = async (content) => {
    const signer = window.nostr;
    const rumor = {
      kind: PRIVATE_DM_KIND,
      created_at: nowSeconds(),
      tags: [["p", SATSIGNER_PUBKEY]],
      content,
      pubkey: await signer.getPublicKey(),
    };
    rumor.id = getEventHash(rumor);
    const seal = await signer.signEvent({
      kind: SEAL_KIND,
      created_at: randomPastSeconds(),
      tags: [],
      content: await signer.nip44.encrypt(SATSIGNER_PUBKEY, JSON.stringify(rumor)),
    });
    return nip59.createWrap(seal, SATSIGNER_PUBKEY);
  };

  const publish = async (wrap) => {
    const relays = await getInboxRelays();
    // SimplePool resolves (not rejects) with a "connection failure: …" string when a relay is unreachable.
    const acceptances = pool.publish(relays, wrap).map((publication) =>
      publication.then((reason) => {
        if (typeof reason === "string" && reason.startsWith(CONNECTION_FAILURE_PREFIX)) {
          throw new Error(reason);
        }
        return reason;
      }),
    );
    const results = await Promise.allSettled(acceptances);
    return results.filter((result) => result.status === "fulfilled").length;
  };

  const readReport = () => {
    const content = reportInput.value.trim();
    if (!content) {
      setStatus("Write your report first.", "bad");
      return null;
    }
    if (new TextEncoder().encode(JSON.stringify(content)).length > MAX_REPORT_BYTES) {
      setStatus("This report is too long to encrypt. Shorten it and try again.", "bad");
      return null;
    }
    return content;
  };

  const send = async (buildWrap) => {
    if (sendState.active) {
      return;
    }
    const content = readReport();
    if (!content) {
      return;
    }
    setBusy(true);
    setStatus("Encrypting and sending…");
    try {
      const delivered = await publish(await buildWrap(content));
      if (delivered === 0) {
        setStatus("No relay accepted the message. Try again in a moment.", "bad");
        return;
      }
      reportInput.value = "";
      setStatus(`Sent. ${delivered} relay${delivered === 1 ? "" : "s"} accepted your encrypted report.`, "ok");
    } catch (error) {
      setStatus(`Could not send: ${error?.message || "unknown error"}`, "bad");
    } finally {
      setBusy(false);
    }
  };

  form.addEventListener("submit", (event) => event.preventDefault());
  anonymousButton.addEventListener("click", () => send(buildAnonymousWrap));
  signedButton.addEventListener("click", () => send(buildSignedWrap));

  // Extensions inject window.nostr after page load, so check again once everything has loaded.
  refreshButtons();
  window.addEventListener("load", () => setTimeout(refreshButtons, 500));
})();

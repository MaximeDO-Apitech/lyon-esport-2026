(() => {
  window.lesUi = {
    badgeClass(value) {
      if (["live", "subscribed", true].includes(value)) return "badge ok";
      if (["invalid", "stale", false].includes(value)) return "badge error";
      return "badge warn";
    },
    date(value) {
      return value ? new Date(value).toLocaleTimeString("fr-FR") : "—";
    },
    commandId(prefix) {
      return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    },
    text(id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? "—";
    },
    async send(message, payload, statusId = "command-status") {
      const status = document.getElementById(statusId);
      try {
        const result = await nodecg.sendMessage(message, payload);
        if (status) status.textContent = result?.duplicate ? "Commande deja appliquee." : "Commande appliquee par l'extension.";
        return result;
      } catch (error) {
        if (status) status.textContent = `Refus: ${error?.message || error}`;
        throw error;
      }
    },
  };
})();

(() => {
  const eventAttributes = ["click", "submit", "change", "input", "focus"];

  function splitArguments(source) {
    const args = [];
    let current = "";
    let quote = "";
    for (const char of source) {
      if (quote) {
        current += char;
        if (char === quote) quote = "";
      } else if (char === "'" || char === '"') {
        quote = char;
        current += char;
      } else if (char === ",") {
        args.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

  function resolveArgument(source, element, event) {
    if (source === "event") return event;
    if (source === "this") return element;
    if (source === "this.dataset.staffId") return element.dataset.staffId;
    if (source === "this.dataset.nextStatus") return element.dataset.nextStatus;
    if (/^-?\d+(?:\.\d+)?$/.test(source)) return Number(source);
    if (source === "true") return true;
    if (source === "false") return false;
    if (source === "null") return null;
    if (/^(['"]).*\1$/s.test(source)) return source.slice(1, -1);
    throw new Error("Unsupported declarative event argument");
  }

  function invoke(element, event, expression) {
    const match = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\((.*)\)$/.exec(expression.trim());
    if (!match) return;
    const [, name, argumentSource] = match;
    const args = splitArguments(argumentSource).map((arg) => resolveArgument(arg, element, event));

    if (name === "window.location.assign") {
      const destination = new URL(args[0], window.location.href);
      if (destination.origin === window.location.origin) window.location.assign(destination.href);
      return;
    }
    if (name === "window.print") {
      window.print();
      return;
    }

    const handler = window[name];
    if (typeof handler === "function") handler(...args);
  }

  document.addEventListener("error", (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const image = event.target;
    if (image.dataset.cspError !== "menuImageFallback") return;
    if (image.dataset.fallbackSrc && !image.src.endsWith(image.dataset.fallbackSrc)) {
      image.src = image.dataset.fallbackSrc;
      image.dataset.fallbackSrc = "";
    } else {
      image.hidden = true;
      image.parentElement?.classList.add("image-fallback");
    }
  }, true);

  for (const type of eventAttributes) {
    document.addEventListener(type, (event) => {
      const element = event.target instanceof Element
        ? event.target.closest(`[data-csp-${type}]`)
        : null;
      if (!element) return;
      if (element.dataset.cspPreventDefault === "true") event.preventDefault();
      const expression = element.dataset[`csp${type[0].toUpperCase()}${type.slice(1)}`];
      if (expression) {
        try {
          invoke(element, event, expression);
        } catch (error) {
          console.error("UI action could not be handled.", error.name);
        }
      }
    }, true);
  }
})();

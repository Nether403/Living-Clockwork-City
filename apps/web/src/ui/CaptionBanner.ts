const CAPTION_VISIBLE_MS = 8_000;

export class CaptionBanner {
  private readonly root = document.createElement("div");
  private readonly text = document.createElement("p");
  private readonly queue: string[] = [];
  private hideTimer: number | null = null;
  private visible = false;

  constructor(container: HTMLElement) {
    this.root.className = "caption-banner";
    this.root.hidden = true;
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");

    this.text.className = "caption-banner__text";
    this.root.append(this.text);
    container.append(this.root);
  }

  show(text: string): void {
    const normalizedText = text.trim();
    if (!normalizedText) return;

    if (this.visible) {
      this.queue.push(normalizedText);
      return;
    }

    this.showNow(normalizedText);
  }

  clear(): void {
    this.queue.length = 0;
    this.visible = false;
    this.text.textContent = "";
    this.root.hidden = true;
    this.clearTimer();
  }

  dispose(): void {
    this.clear();
    this.root.remove();
  }

  private showNow(text: string): void {
    this.visible = true;
    this.text.textContent = text;
    this.root.hidden = false;
    this.clearTimer();
    this.hideTimer = window.setTimeout(() => {
      this.hide();
    }, CAPTION_VISIBLE_MS);
  }

  private hide(): void {
    this.visible = false;
    this.text.textContent = "";
    this.root.hidden = true;
    this.clearTimer();

    const next = this.queue.shift();
    if (next) {
      this.showNow(next);
    }
  }

  private clearTimer(): void {
    if (this.hideTimer === null) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }
}

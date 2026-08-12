import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * WCAG contrast audit — the CI styling net.
 *
 * Walks every visible text element on every route (in both themes and both
 * auth modes), computes the real WCAG contrast ratio against the effective
 * background (alpha-blended up the ancestor chain), and fails the test on any
 * element below its threshold (4.5:1 small text, 3:1 large/bold).
 *
 * Unlike visual.spec.ts this is computed-style based, so it has no screenshot
 * baselines and runs identically on any platform — including CI. The signed-in
 * mode uses the QA seam (localStorage["changers-fake-user"]), which is
 * client-side only; every API route still requires a real JWT.
 *
 * The data-driven states the plain seam can't reach — the /badges earned grid
 * and the /impact scoreboard — are covered by a third matrix dimension that
 * also sets the changers-fake-data seam, feeding deterministic fixtures
 * (web/lib/qa/fixtures.ts).
 */
test.describe("contrast audit", () => {
  // The full-matrix tests walk 46 routes per theme/mode — well past the
  // 30s default. The coverage test below is unaffected (runs in ms).
  test.describe.configure({ timeout: 120_000 });

  const ROUTES = [
    "/",
    "/posts",
    "/projects",
    "/rooms",
    "/events",
    "/messages",
    "/network",
    "/mentors",
    "/impact",
    "/badges",
    "/cas",
    "/settings",
    "/notifications",
    "/documents",
    "/tools",
    "/tools/code",
    "/tools/design",
    "/tools/films",
    "/tools/tables",
    "/slideshows",
    "/documents/new",
    "/slideshows/new",
    "/tools/code/new",
    "/tools/design/new",
    "/tools/films/new",
    "/tools/tables/new",
    "/search?q=plastic",
    "/contact",
    "/privacy",
    "/dashboard",
    "/admin",
    "/sign-in",
    "/sign-up",
    "/setup-admin",
  ];

  // Dynamic detail pages ([id] segments) can't be enumerated statically, so
  // each is audited with a representative sample id. The coverage test below
  // keeps this list in sync with the app directory.
  const DYNAMIC_ROUTES = [
    "/call/sample",
    "/documents/sample",
    "/events/sample",
    "/messages/sample",
    "/posts/sample",
    "/profile/sample",
    "/projects/sample",
    "/rooms/sample",
    "/slideshows/sample",
    "/tools/code/sample",
    "/tools/design/sample",
    "/tools/films/sample",
    "/tools/tables/sample",
  ];

  const THEMES = [
    {
      name: "light",
      storage: "light",
      colorScheme: "light" as const,
      defaultBg: [255, 255, 255, 1] as [number, number, number, number],
    },
    {
      name: "dark",
      storage: "dark",
      colorScheme: "dark" as const,
      defaultBg: [23, 37, 33, 0.96] as [number, number, number, number],
    },
  ];

  const MODES = [
    { name: "signed-out", fakeUser: false },
    { name: "signed-in", fakeUser: true },
  ];

  // Data-driven states (badge-earned grid, impact scoreboard) need fixture
  // data the plain seam doesn't provide — the changers-fake-data seam does.
  const DATA_MODE = { name: "signed-in · data", fakeUser: true, fakeData: true };
  const DATA_ROUTES = ["/badges", "/impact"];

  async function seed(page: Page, theme: string, fakeUser: boolean, fakeData = false) {
    await page.addInitScript(
      ({ theme: t, fakeUser: f, fakeData: d }) => {
        localStorage.setItem("changers-theme", t);
        if (f) localStorage.setItem("changers-fake-user", "1");
        if (d) localStorage.setItem("changers-fake-data", "1");
      },
      { theme, fakeUser, fakeData },
    );
  }

  /** Audits one route, returning any contrast violations found on it. */
  async function audit(
    page: Page,
    theme: (typeof THEMES)[number],
    route: string,
  ): Promise<{ route: string; el: string; ratio: number; fg: string; bg: string }[]> {
    await page.goto(route);
    // Let client-side rendering settle (the app renders empty/sign-in states
    // without a backend — the audit covers whatever renders).
    await page.waitForTimeout(700);

    const found = await page.evaluate((dflt) => {
      function lum(r: number, g: number, b: number) {
        const f = (c: number) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function blend(
        fg: [number, number, number, number],
        bg: [number, number, number, number],
      ): [number, number, number, number] {
        const a = fg[3] + bg[3] * (1 - fg[3]);
        if (a === 0) return [0, 0, 0, 0];
        return [
          (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
          (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
          (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
          a,
        ];
      }
      function parse(s: string): [number, number, number, number] | null {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
      }

      const out: { el: string; ratio: number; fg: string; bg: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      const els: Element[] = [];
      while (walker.nextNode()) els.push(walker.currentNode as Element);

      for (const el of els) {
        const text = (el.textContent || "").trim();
        if (!text || text.length < 2) continue;
        // Only leaf text owners (the element whose own text this is).
        const owns = el.children.length === 0 || (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3);
        if (!owns) continue;
        // WCAG 2.1 exempts inactive UI components: text on disabled form
        // controls doesn't need 4.5:1 (e.g. a disabled Save button).
        if (
          el instanceof HTMLButtonElement ||
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          if ((el as HTMLButtonElement).disabled) continue;
        }

        const cs = getComputedStyle(el);
        // Walk ancestors collecting translucent layers, stopping at the first
        // opaque one. Gradient/image backgrounds are invisible to
        // backgroundColor, so an element sitting on one (or on glass over one)
        // can't be audited and is skipped — e.g. the .primary coral→sun
        // buttons (sampled ~9:1) and white text on the moss→teal CTA band.
        let gradientBlocked = false;
        const layers: [number, number, number, number][] = [];
        let node: Element | null = el;
        while (node) {
          const ncs = getComputedStyle(node);
          if (ncs.backgroundImage !== "none") {
            const b = parse(ncs.backgroundColor);
            if (!b || b[3] <= 0.02) {
              gradientBlocked = true;
              break;
            }
          }
          const b = parse(ncs.backgroundColor);
          if (b && b[3] > 0.02) {
            layers.push(b);
            if (b[3] >= 0.95) break; // opaque — nothing above matters
          }
          node = node.parentElement;
        }
        if (gradientBlocked) continue;
        // Composite farthest layer first so the nearest sits on top.
        let bg: [number, number, number, number] = dflt;
        for (let i = layers.length - 1; i >= 0; i -= 1) bg = blend(layers[i], bg);

        const fg = parse(cs.color);
        if (!fg) continue;
        const fs = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const need = fs >= 18.66 || (fs >= 14 && bold) ? 3 : 4.5;

        // Correct WCAG: text color = fg alpha-blended over the effective
        // background, then luminance-compared against that background.
        const final = blend(fg, bg);
        const l1 = lum(final[0], final[1], final[2]);
        const l2 = lum(bg[0], bg[1], bg[2]);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < need) {
          out.push({
            el: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`,
            ratio: +ratio.toFixed(2),
            fg: cs.color,
            bg: `rgb(${bg.slice(0, 3).map(Math.round).join(",")})`,
          });
        }
      }
      return out;
    }, theme.defaultBg);

    return found.map((v) => ({ route, ...v }));
  }

  /** De-duplicates and fails the test with the worst violations first. */
  function assertNoViolations(violations: { route: string; el: string; ratio: number; fg: string; bg: string }[]) {
    const unique = new Map<string, (typeof violations)[number]>();
    for (const v of violations) {
      unique.set(`${v.route}|${v.el}|${v.fg}`, v);
    }
    const sorted = [...unique.values()].sort((a, b) => a.ratio - b.ratio);
    if (sorted.length > 0) {
      const detail = sorted
        .slice(0, 40)
        .map((v) => `${v.ratio.toFixed(2)}:1 ${v.route} ${v.el} fg=${v.fg} bg=${v.bg}`)
        .join("\n");
      expect(sorted, `WCAG contrast violations (${sorted.length} unique):\n${detail}`).toEqual([]);
    }
  }

  /**
   * Coverage guard: CI fails if a page route exists in the app directory but
   * isn't audited here, or if an audited route no longer exists in the app.
   * Keeps the contrast net from silently missing new pages.
   */
  function pageFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...pageFiles(full));
      else if (entry.endsWith(".tsx")) out.push(full);
    }
    return out;
  }

  test("audit covers every page route in the app directory", () => {
    const pages = pageFiles("app")
      .filter((p) => !p.startsWith(join("app", "api")) && p.endsWith("/page.tsx"))
      .map((p) => p.replace(/^app\//, "").replace(/(^|\/)page\.tsx$/, ""));

    const staticRoutes = new Set(pages.filter((p) => !/\[[^\]]+\]/.test(p)).map((p) => "/" + p));
    const dynamicRoutes = new Set(
      pages
        .filter((p) => /\[[^\]]+\]/.test(p))
        .map((p) => "/" + p.replace(/\[[^\]]+\]/g, "sample")),
    );

    const audited = new Set([...ROUTES, ...DYNAMIC_ROUTES].map((r) => r.split("?")[0]));

    const missingStatic = [...staticRoutes].filter((r) => !audited.has(r));
    const missingDynamic = [...dynamicRoutes].filter((r) => !audited.has(r));
    const unknown = [...audited].filter((r) => !staticRoutes.has(r) && !dynamicRoutes.has(r));

    const problems: string[] = [];
    if (missingStatic.length > 0) {
      problems.push(
        `pages exist in app/ but are missing from ROUTES:\n  ${missingStatic.join("\n  ")}`,
      );
    }
    if (missingDynamic.length > 0) {
      problems.push(
        `dynamic pages exist in app/ but are missing from DYNAMIC_ROUTES:\n  ${missingDynamic.join("\n  ")}`,
      );
    }
    if (unknown.length > 0) {
      problems.push(
        `audited routes that don't exist in app/ (remove from ROUTES/DYNAMIC_ROUTES):\n  ${unknown.join("\n  ")}`,
      );
    }
    expect(problems, problems.join("\n\n")).toEqual([]);
  });

  for (const theme of THEMES) {
    for (const mode of MODES) {
      test(`${mode.name} · ${theme.name} theme`, async ({ page }) => {
        await seed(page, theme.storage, mode.fakeUser);
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme.colorScheme });

        const violations: { route: string; el: string; ratio: number; fg: string; bg: string }[] = [];
        for (const route of [...ROUTES, ...DYNAMIC_ROUTES]) {
          violations.push(...(await audit(page, theme, route)));
        }
        assertNoViolations(violations);
      });
    }

    test(`${DATA_MODE.name} · ${theme.name} theme`, async ({ page }) => {
      await seed(page, theme.storage, DATA_MODE.fakeUser, DATA_MODE.fakeData);
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme.colorScheme });

      const violations: { route: string; el: string; ratio: number; fg: string; bg: string }[] = [];
      for (const route of DATA_ROUTES) {
        violations.push(...(await audit(page, theme, route)));
      }
      assertNoViolations(violations);
    });
  }
});

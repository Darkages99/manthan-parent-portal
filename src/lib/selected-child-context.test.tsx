// @vitest-environment happy-dom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "manthan:selectedChildId";
const students = [
  { id: "s1", first_name: "Asha", last_name: "K" },
  { id: "s2", first_name: "Ravi", last_name: "K" },
];

// The store keeps module-level state, so every test gets a fresh copy.
async function load() {
  vi.resetModules();
  return import("./selected-child-context");
}

async function mount() {
  const { SelectedChildProvider, useSelectedChild } = await load();
  function Probe() {
    const { selectedChildId, setSelectedChildId } = useSelectedChild();
    return (
      <button type="button" onClick={() => setSelectedChildId("s2")}>
        {selectedChildId ?? "none"}
      </button>
    );
  }
  const tree = (
    <SelectedChildProvider students={students}>
      <Probe />
    </SelectedChildProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  const serverText = container.textContent;
  document.body.appendChild(container);
  await act(async () => {
    hydrateRoot(container, tree);
  });
  const button = container.querySelector("button")!;
  return { serverText, button };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SelectedChildProvider", () => {
  it("server-renders the first child and keeps it when nothing is stored", async () => {
    const { serverText, button } = await mount();
    expect(serverText).toBe("s1");
    expect(button.textContent).toBe("s1");
  });

  it("restores a stored child after hydration", async () => {
    localStorage.setItem(STORAGE_KEY, "s2");
    const { serverText, button } = await mount();
    expect(serverText).toBe("s1");
    expect(button.textContent).toBe("s2");
  });

  it("falls back to the first child when the stored id is no longer theirs", async () => {
    localStorage.setItem(STORAGE_KEY, "removed-child");
    const { button } = await mount();
    expect(button.textContent).toBe("s1");
  });

  it("switching child re-renders and persists the choice", async () => {
    const { button } = await mount();
    await act(async () => button.click());
    expect(button.textContent).toBe("s2");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("s2");
  });

  it("still switches when localStorage throws (private mode)", async () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    const { button } = await mount();
    expect(button.textContent).toBe("s1");
    await act(async () => button.click());
    expect(button.textContent).toBe("s2");
  });
});

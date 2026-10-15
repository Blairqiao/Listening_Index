import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { Artwork } from "../src/components/Artwork";

test("Artwork renders unconfigured hostnames without throwing runtime errors", () => {
  assert.doesNotThrow(() => {
    const html = ReactDOMServer.renderToString(
      React.createElement(Artwork, {
        src: "https://unconfigured-third-party-cdn.example.com/cover.jpg",
        alt: "Test Album",
        size: 38,
      })
    );
    assert.ok(
      html.includes("unconfigured-third-party-cdn.example.com"),
      "Rendered HTML should include image src"
    );
  });
});

test("Artwork renders color swatch fallback when src is missing", () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Artwork, {
      src: null,
      alt: "Missing Art",
      size: 38,
    })
  );
  assert.ok(html.includes("background-color"), "Should render color swatch span");
  assert.ok(!html.includes("<img"), "Should not render img tag");
});

test("Artwork renders delisted indicator when isDelisted is true", () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Artwork, {
      src: "https://i.scdn.co/image/test",
      alt: "Delisted Track",
      size: 38,
      isDelisted: true,
    })
  );
  assert.ok(html.includes("Track delisted"), "Should render delisted title or aria-label");
  assert.ok(html.includes("✕"), "Should render delisted ✕ icon");
});

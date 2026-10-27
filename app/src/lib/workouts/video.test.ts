import { describe, expect, it } from "vitest";
import { toEmbedUrl, videoSource } from "./video";

describe("toEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/abcDEF12345", "https://www.youtube-nocookie.com/embed/abcDEF12345"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"],
  ])("embeds %s", (input, expected) => {
    expect(toEmbedUrl(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "not a url",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=<script>",
    "javascript:alert(1)",
  ])("rejects %s", (input) => {
    expect(toEmbedUrl(input)).toBeNull();
  });
});

describe("videoSource", () => {
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://vimeo.com/123456789", "vimeo"],
    ["https://www.tiktok.com/@personal/video/7300000000000000000", "tiktok"],
    ["https://vm.tiktok.com/ZMabc123/", "tiktok"],
    ["https://www.instagram.com/reel/Cabc123/", "instagram"],
    ["https://tiktok.com.evil.example/video/1", "link"],
    ["not a url", "link"],
  ])("%s → %s", (url, source) => expect(videoSource(url)).toBe(source));
});

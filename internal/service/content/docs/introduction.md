---
title: "Introduction"
description: "Welcome to templUI - Beautiful UI components for Go developers."
order: 1
---

## Introduction

> **This is a maintained fork of [templui/templui](https://github.com/templui/templui), continuing the v1 line, and it is heavily opinionated.** Upstream became [shadcn-templ](https://github.com/axadrn/shadcn-templ), whose v2 component set drops `timepicker`, `datepicker`, `selectbox`, `form`, `rating`, `tagsinput`, `radio` and `dropdown` in favour of base-ui-style ports. This fork keeps the v1 set alive and improves it where the applications built on it need improving. Component APIs may break within v1, upstream changes are taken on merit rather than wholesale, and there is no commitment to feature parity with upstream v2 — see the [README](https://github.com/RimJur/templui#what-heavily-opinionated-means). Pin a version.

templUI is a growing collection of beautifully designed components built with templ and Tailwind CSS. You can use it in two ways: install components into your own repo with the CLI, or import component packages directly from `github.com/RimJur/templui`. Everything is customizable, type-safe, and yours to own.

**Two supported workflows.** Use the CLI if you want the source copied into your app. Use direct imports if you want the simplest setup. Follow our [releases](https://github.com/RimJur/templui/releases) to see what's new.

## Why templUI

Heavily inspired by [shadcn/ui](https://ui.shadcn.com/), templUI brings the same philosophy to Go developers. Use the CLI for full ownership of copied source, or direct imports for a simpler dependency-based workflow.

Every component is designed to be beautiful by default, fully accessible, and CSP compliant. No magic, no hidden complexity – just clean, customizable code that works.

## Scope of this fork

templUI embraces Go's philosophy: simple, reliable, and performant – server-side rendering at its core, progressive enhancement where it matters. That part is unchanged, and it is why this fork exists rather than a rewrite.

What is different is the scope. There is no roadmap to expand the component set: the v1 components are the set, and the work is keeping them correct, accessible and pleasant to use. Changes land because an application depending on this needed them — which means a fix upstream declined may well be implemented here, and an upstream change that buys nothing may not be taken at all. Breaking changes are documented in the changelog with their reasoning rather than deferred to a major version.

If you want a neutral, community-governed library with a published roadmap, use [shadcn-templ](https://github.com/axadrn/shadcn-templ). If you want the v1 component set to keep working, this is that.

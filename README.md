A page for showcasing some of my personal projects and writings.

Built with [11ty](https://www.11ty.dev/).

## Build

```sh
npm install
npm run build    # outputs to _site/
npm run serve    # dev server at http://localhost:8080
```

## Adding a new page

Create a markdown file in the project root with frontmatter:

```md
---
title: My Project — jazwa
layout: project.njk
---

# My Project

Content goes here. You can use markdown or HTML.
```

The page will be available at `/my-project/` after `npm run build`.

### Layouts

- `base.njk` — shared shell (shader background, CSS, card wrapper)
- `project.njk` — extends base, adds image gallery grid and back link

## Woodworking Projects

### [Shaker Endtable](./page/shaker-endtable.md)
A little Shaker-style endtable made out of cherry and some birdseye maple.

### [Figurine Shelf](./page/figurine-shelf.md)
A simple shelf hacked together for some of Clemence's figurines.

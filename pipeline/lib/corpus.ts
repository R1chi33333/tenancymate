/**
 * Corpus pipeline: turn the whole-act HTML from legislation.govt.nz
 * into section records ready for embedding.
 *
 * The markup is machine-generated and regular: every section is a
 * `div.prov` whose h5 carries a numeric label (13, 13A, 66B) and a
 * heading, preceded by `h1/h2.part` headings that give the hierarchy.
 * Schedules also use prov divs but carry non-section labels and are
 * skipped for the MVP; the eval set only targets sections.
 */

export interface Section {
  /** Section number as printed, e.g. "23" or "13A". */
  id: string;
  heading: string;
  /** "Part 2 Tenancy agreements" style context, when present. */
  part: string | null;
  /** Plain text of the section body, subsection labels kept inline. */
  text: string;
}

export interface Chunk {
  sectionId: string;
  heading: string;
  part: string | null;
  /** 0-based index of this chunk within its section. */
  index: number;
  /** The text that gets embedded, prefixed with its context. */
  text: string;
}

const SECTION_LABEL = /^\d+[A-Z]{0,3}$/;

/** Strip tags and collapse whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h\d)>/gi, ' \n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

interface Marker {
  kind: 'part' | 'prov';
  start: number;
  content: string;
}

/** Parse the whole-act HTML into ordered sections with part context. */
export function parseAct(fullHtml: string): Section[] {
  // Schedules re-print amendment-act provisions with plain numeric
  // labels, which would collide with real section numbers; the main
  // act ends where the first schedule heading begins.
  const scheduleStart = fullHtml.search(/<h[12][^>]*class="schedule"/);
  const html = scheduleStart === -1 ? fullHtml : fullHtml.slice(0, scheduleStart);

  const markers: Marker[] = [];

  const partPattern = /<h[12][^>]*class="part"[^>]*>(.*?)<\/h[12]>/gs;
  for (let m = partPattern.exec(html); m; m = partPattern.exec(html)) {
    markers.push({ kind: 'part', start: m.index, content: m[1] ?? '' });
  }

  const provPattern = /<div class="prov" id="DLM\d+">/g;
  for (let m = provPattern.exec(html); m; m = provPattern.exec(html)) {
    markers.push({ kind: 'prov', start: m.index, content: '' });
  }

  markers.sort((a, b) => a.start - b.start);

  const sections: Section[] = [];
  let currentPart: string | null = null;

  for (const [i, marker] of markers.entries()) {
    if (marker.kind === 'part') {
      currentPart = htmlToText(marker.content).replace(/\n/g, ' ').trim();
      continue;
    }

    const end = markers[i + 1]?.start ?? html.length;
    const block = html.slice(marker.start, end);

    const head = /<h5 class="prov">\s*<span class="label">([^<]+)<\/span>(.*?)<\/h5>/s.exec(block);
    if (!head) {
      continue;
    }
    const label = (head[1] ?? '').trim();
    if (!SECTION_LABEL.test(label)) {
      continue; // schedule provisions and other non-section blocks
    }

    const heading = htmlToText(head[2] ?? '')
      .replace(/\n/g, ' ')
      .trim();
    const bodyHtml = block.slice(block.indexOf('</h5>') + 5);
    const text = htmlToText(bodyHtml);
    if (text === '') {
      continue; // repealed sections carry no body
    }

    sections.push({ id: label, heading, part: currentPart, text });
  }

  return sections;
}

export const CHUNK_TARGET_CHARS = 1400;

/**
 * Split a section into embedding-sized chunks on paragraph
 * boundaries. Every chunk repeats the section context so the
 * embedding carries "s 23 Bond" even for a middle chunk.
 */
export function chunkSection(section: Section): Chunk[] {
  const prefix = `Residential Tenancies Act 1986, s ${section.id} ${section.heading}.`;
  const paragraphs = section.text.split('\n').filter((line) => line.trim() !== '');

  const bodies: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current !== '' && current.length + paragraph.length + 1 > CHUNK_TARGET_CHARS) {
      bodies.push(current);
      current = paragraph;
    } else {
      current = current === '' ? paragraph : `${current}\n${paragraph}`;
    }
  }
  if (current !== '') {
    bodies.push(current);
  }

  return bodies.map((body, index) => ({
    sectionId: section.id,
    heading: section.heading,
    part: section.part,
    index,
    text: `${prefix}\n${body}`,
  }));
}

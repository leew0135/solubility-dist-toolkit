/*
 * references.js — the papers listed on "How to cite", and the three export formats.
 *
 * WHAT IT DOES
 *   REFERENCES is the single list of method papers. The page shows them as text and
 *   offers them as BibTeX (.bib), EndNote (.enw) and RIS (.ris); all are generated
 *   from this list, so a correction here fixes every format.
 *
 * HOW TO CHANGE
 *   Add or correct a paper -> edit REFERENCES (authors as "Family, Given" in order).
 *   The sentence people can paste into their Methods -> methodsText().
 *   How the software itself is cited -> softwareText().
 */
export const REFERENCES = [
  {
    key: "Kuwata2017",
    authors: ["Kuwata, Mikinori", "Lee, Wen-Chien"],
    year: 2017,
    title: "1-octanol-water partitioning as a classifier of water soluble organic matters: Implication for solubility distribution",
    journal: "Aerosol Science and Technology", volume: "51", issue: "5", pages: "602–613",
    doi: "10.1080/02786826.2017.1283004",
    role: "Theory and concept of the method; α from mass spectra (tool ⓪)",
  },
  {
    key: "Lee2019",
    authors: ["Lee, Wen-Chien", "Chen, Jing", "Budisulistiorini, Sri Hapsari", "Itoh, Masayuki", "Shiodera, Satomi", "Kuwata, Mikinori"],
    year: 2019,
    title: "Polarity-dependent chemical characteristics of water-soluble organic matter from laboratory-generated biomass-burning revealed by 1-octanol–water partitioning",
    journal: "Environmental Science & Technology", volume: "53", issue: "14", pages: "8047–8056",
    doi: "10.1021/acs.est.9b01691",
    role: "Application to biomass-burning WSOM",
  },
  {
    key: "Lee2020",
    authors: ["Lee, Wen-Chien", "Chen, Jing", "Kuwata, Mikinori"],
    year: 2020,
    title: "An inversion method for polarity distribution of atmospheric water-soluble organic matter",
    journal: "Aerosol Science and Technology", volume: "54", issue: "", pages: "1504–1514",
    doi: "10.1080/02786826.2020.1795482",
    role: "Data inversion (tool ①)",
  },
  {
    key: "Lee2022",
    authors: ["Lee, Wen-Chien", "Deng, Yange", "Zhou, Ruichen", "Itoh, Masayuki", "Mochida, Michihiro", "Kuwata, Mikinori"],
    year: 2022,
    title: "Water solubility distribution of organic matter accounts for the discrepancy in hygroscopicity among sub- and supersaturated humidity regimes",
    journal: "Environmental Science & Technology", volume: "56", issue: "24", pages: "17924–17935",
    doi: "10.1021/acs.est.2c04647",
    role: "Köhler model with solubility distributions (tool ②); mosquito coil and peat example data",
  },
  {
    key: "Lee2023",
    authors: ["Lee, Wen-Chien", "Liu, Pengfei", "Han, Yuemei", "Martin, Scot T.", "Kuwata, Mikinori"],
    year: 2023,
    title: "Accounting for cloud nucleation activation mechanism of secondary organic matter from α-pinene oxidation using experimentally retrieved water solubility distributions",
    journal: "Environmental Science & Technology", volume: "57", issue: "36", pages: "13439–13448",
    doi: "10.1021/acs.est.3c03039",
    role: "α-pinene example data; κ_intr fit",
  },
];

const initials = (given) => given.split(/[\s]+/).map((part) => part.split("-").map((p) => `${p[0]}.`).join("-")).join(" ");
const shortName = (author) => { const [family, given] = author.split(", "); return `${family}, ${initials(given)}`; };
const firstLast = (pages) => pages.split("–");

/** "Kuwata, M. and Lee, W.-C. (2017) Title. Journal 51, 602–613." (html = true puts the journal in italics) */
export function referenceText(r, html = false) {
  const names = r.authors.map(shortName);
  const authors = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const journal = html ? `<i>${r.journal}</i>` : r.journal;
  return `${authors} (${r.year}) ${r.title}. ${journal} ${r.volume}, ${r.pages}. https://doi.org/${r.doi}`;
}

export function toBibTeX(refs = REFERENCES) {
  return refs.map((r) => {
    const fields = [
      ["author", r.authors.join(" and ")], ["title", `{${r.title}}`], ["journal", r.journal], ["year", r.year],
      ["volume", r.volume], ["number", r.issue], ["pages", r.pages.replace("–", "--")], ["doi", r.doi],
    ].filter(([, v]) => v !== "");
    return `@article{${r.key},\n${fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n")}\n}`;
  }).join("\n\n") + "\n";
}

export function toRIS(refs = REFERENCES) {
  return refs.map((r) => {
    const [start, end] = firstLast(r.pages);
    const lines = [
      "TY  - JOUR", ...r.authors.map((a) => `AU  - ${a}`), `PY  - ${r.year}`, `TI  - ${r.title}`, `JO  - ${r.journal}`,
      `VL  - ${r.volume}`, ...(r.issue ? [`IS  - ${r.issue}`] : []), `SP  - ${start}`, `EP  - ${end}`,
      `DO  - ${r.doi}`, `UR  - https://doi.org/${r.doi}`, "ER  - ",
    ];
    return lines.join("\n");
  }).join("\n\n") + "\n";
}

export function toEndNote(refs = REFERENCES) {
  return refs.map((r) => {
    const lines = [
      "%0 Journal Article", ...r.authors.map((a) => `%A ${a}`), `%D ${r.year}`, `%T ${r.title}`, `%J ${r.journal}`,
      `%V ${r.volume}`, ...(r.issue ? [`%N ${r.issue}`] : []), `%P ${r.pages.replace("–", "-")}`,
      `%R ${r.doi}`, `%U https://doi.org/${r.doi}`,
    ];
    return lines.join("\n");
  }).join("\n\n") + "\n";
}

export function methodsText(site) {
  return `Water-solubility distributions were retrieved from 1-octanol–water partitioning data (Kuwata and Lee, 2017) by non-negative least-squares inversion with Monte Carlo uncertainty estimation (Lee et al., 2020), using the ${site.title} v${site.version} (${site.url || location.origin + location.pathname}).`;
}

export function softwareText(site) {
  return `${site.title}, version ${site.version}, ${site.year}. ${site.github}`;
}

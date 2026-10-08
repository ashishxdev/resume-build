import Link from "next/link";

export function SiteBrand() {
  return (
    <Link className="brand" href="/" aria-label="Make My Resume home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <b>MAKE MY</b>
        <b>RESUME</b>
      </span>
    </Link>
  );
}

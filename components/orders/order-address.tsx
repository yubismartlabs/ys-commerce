import { countryName } from "@/lib/addresses/countries";
import { formatAddressLines } from "@/lib/addresses/schema";

/**
 * The order's shipping snapshot, rendered the same way everywhere it's shown:
 * buyer order detail, seller sales view, admin order detail.
 *
 * Order pages must read the snapshot columns directly, never join back to the
 * address book — the whole point of the snapshot is that it survives the
 * buyer editing or deleting the saved address.
 */
export function OrderAddress({
  address,
  className = "",
}: {
  address: {
    shipName?: string | null;
    shipPhone?: string | null;
    shipLine1?: string | null;
    shipLine2?: string | null;
    shipCity?: string | null;
    shipRegion?: string | null;
    shipPostalCode?: string | null;
    shipCountry?: string | null;
  };
  className?: string;
}) {
  const lines = formatAddressLines({
    line1: address.shipLine1 ?? null,
    line2: address.shipLine2 ?? null,
    city: address.shipCity ?? null,
    region: address.shipRegion ?? null,
    postalCode: address.shipPostalCode ?? null,
  });
  const name = address.shipName?.trim();
  // Orders placed before the address book existed have no country on file.
  const country = countryName(address.shipCountry);

  if (!name && lines.length === 0) {
    return <span className={className}>—</span>;
  }

  return (
    <address className={`not-italic leading-relaxed ${className}`}>
      {name ? <span className="font-medium">{name}</span> : null}
      {name && lines.length > 0 ? <br /> : null}
      {lines.map((l, i) => (
        <span key={l + i}>
          {l}
          {i < lines.length - 1 || country ? <br /> : null}
        </span>
      ))}
      {country ? <span>{country}</span> : null}
      {address.shipPhone ? (
        <>
          <br />
          {address.shipPhone}
        </>
      ) : null}
    </address>
  );
}
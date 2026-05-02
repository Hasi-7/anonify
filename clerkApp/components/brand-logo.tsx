import Image from "next/image";

type BrandLogoProps = {
  subtitle?: string;
  variant?: "lockup" | "mark" | "wordmark";
};

export function BrandLogo({ subtitle, variant = "lockup" }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        alt="Anonify"
        className="brand-logo-mark"
        height={40}
        src="/anonify-mark.svg"
        width={40}
      />
    );
  }

  if (variant === "wordmark") {
    return <span className="brand-wordmark">Anonify</span>;
  }

  return (
    <div className="brand-lockup">
      <Image
        alt=""
        aria-hidden="true"
        className="brand-logo-mark"
        height={40}
        src="/anonify-mark.svg"
        width={40}
      />
      <div>
        <span className="brand-wordmark">Anonify</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
}

import { links, restaurant } from "../config";
import { InstagramIcon, WhatsAppIcon } from "./icons";

export function Footer() {
  return (
    <footer className="footer" data-testid="footer">
      <h2 className="footer-title">Contacto</h2>
      <address>
        <p data-testid="address">{restaurant.address}</p>
        <p>
          <a href={links.phone} data-testid="phone-link">
            {restaurant.phone}
          </a>
        </p>
      </address>
      <ul className="footer-links">
        <li>
          <a
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            aria-label="WhatsApp"
            title="WhatsApp"
            data-testid="whatsapp-link"
          >
            <WhatsAppIcon />
          </a>
        </li>
        <li>
          <a
            href={links.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            aria-label={`Instagram @${restaurant.instagramHandle}`}
            title={`Instagram @${restaurant.instagramHandle}`}
            data-testid="instagram-link"
          >
            <InstagramIcon />
          </a>
        </li>
      </ul>
    </footer>
  );
}

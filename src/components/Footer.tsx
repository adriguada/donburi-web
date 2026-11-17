import { links, restaurant } from "../config";

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
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-link">
            WhatsApp
          </a>
        </li>
        <li>
          <a href={links.instagram} target="_blank" rel="noopener noreferrer" data-testid="instagram-link">
            Instagram @{restaurant.instagramHandle}
          </a>
        </li>
      </ul>
    </footer>
  );
}

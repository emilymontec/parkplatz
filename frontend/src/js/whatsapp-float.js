/**
 * Botón Flotante WhatsApp
 * Configurable con número de teléfono y mensaje
 */

class WhatsAppFloat {
  constructor(config = {}) {
    this.phoneNumber = config.phoneNumber || '+573246372082';
    this.message = config.message || '¡Hola! Me interesa conocer más sobre vuestros servicios de estacionamiento.';
    this.title = config.title || '¿Necesitas Ayuda?';
    this.showMessage = config.showMessage !== false;
    this.showPulse = config.showPulse !== false;
    this.init();
  }

  init() {
    this.createFloatingButton();
    this.attachEventListeners();
    
    // Mostrar mensaje después de 2 segundos si está habilitado
    if (this.showMessage) {
      setTimeout(() => {
        this.showInitialMessage();
      }, 2000);
    }
  }

  createFloatingButton() {
    const container = document.createElement('div');
    container.className = 'whatsapp-float';
    container.id = 'whatsapp-float-container';

    // Crear mensaje
    if (this.showMessage) {
      const messageBox = document.createElement('div');
      messageBox.className = 'whatsapp-message-box';
      messageBox.id = 'whatsapp-message';
      messageBox.innerHTML = `
        <div class="whatsapp-message-title">
          <i class="fas fa-comments"></i>
          ${this.title}
        </div>
        <div class="whatsapp-message-text">
          El equipo de Parkplatz está disponible para ayudarte
        </div>
      `;
      container.appendChild(messageBox);
    }

    // Crear botón
    const button = document.createElement('button');
    button.className = `whatsapp-button ${this.showPulse ? 'pulse' : ''}`;
    button.id = 'whatsapp-btn';
    button.title = 'Contáctanos por WhatsApp';
    button.innerHTML = '<i class="fab fa-whatsapp"></i>';
    
    container.appendChild(button);
    document.body.appendChild(container);
  }

  attachEventListeners() {
    const button = document.getElementById('whatsapp-btn');
    
    button.addEventListener('click', () => {
      this.openWhatsApp();
    });

    // Ocultar mensaje al hacer clic en el botón
    button.addEventListener('mouseenter', () => {
      const messageBox = document.getElementById('whatsapp-message');
      if (messageBox) {
        messageBox.style.opacity = '0.7';
      }
    });

    button.addEventListener('mouseleave', () => {
      const messageBox = document.getElementById('whatsapp-message');
      if (messageBox) {
        messageBox.style.opacity = '1';
      }
    });

    // Cerrar mensaje al hacer clic en él
    const messageBox = document.getElementById('whatsapp-message');
    if (messageBox) {
      messageBox.addEventListener('click', () => {
        this.hideMessage();
      });
    }
  }

  openWhatsApp() {
    // Formato de WhatsApp: https://wa.me/NUMERO?text=MENSAJE
    const encodedMessage = encodeURIComponent(this.message);
    const whatsappURL = `https://wa.me/${this.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    
    window.open(whatsappURL, '_blank');
  }

  showInitialMessage() {
    const messageBox = document.getElementById('whatsapp-message');
    if (messageBox) {
      messageBox.style.animation = 'messageSlideIn 0.5s ease-out';
      messageBox.style.display = 'block';
    }
  }

  hideMessage() {
    const messageBox = document.getElementById('whatsapp-message');
    if (messageBox) {
      messageBox.style.animation = 'fadeOut 0.3s ease-out forwards';
    }
  }

  showBadge(count = 1) {
    const button = document.getElementById('whatsapp-btn');
    if (!button.querySelector('.whatsapp-badge')) {
      const badge = document.createElement('div');
      badge.className = 'whatsapp-badge';
      badge.textContent = count;
      button.appendChild(badge);
    }
  }

  removeBadge() {
    const badge = document.querySelector('.whatsapp-badge');
    if (badge) {
      badge.remove();
    }
  }

  updateMessage(newMessage) {
    this.message = newMessage;
  }

  remove() {
    const container = document.getElementById('whatsapp-float-container');
    if (container) {
      container.remove();
    }
  }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WhatsAppFloat;
}

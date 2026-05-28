import React, { useEffect, useRef } from 'react';

const FloatingBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    const particleCount = 65;
    
    // Track mouse coordinates
    const mouse = {
      x: null,
      y: null,
      radius: 120, // repulsion radius
    };

    const handleMouseMove = (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    resizeCanvas();

    // Particle Blueprint
    class Particle {
      constructor() {
        this.reset();
        // Distribute initially throughout the screen height
        this.y = Math.random() * canvas.height;
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20; // Start below screen (upward drift)
        this.size = Math.random() * 2 + 0.5; // Star size
        this.speedY = -(Math.random() * 0.4 + 0.15); // Negative speed for upward movement
        this.speedX = (Math.random() - 0.5) * 0.15; // Small horizontal drift
        this.baseAlpha = Math.random() * 0.5 + 0.2;
        this.alpha = this.baseAlpha;
        this.pulseSpeed = Math.random() * 0.02 + 0.005;
        this.pulseDir = 1;
        this.color = Math.random() > 0.4 
          ? 'rgba(0, 240, 255,'  // Neon Cyan
          : 'rgba(171, 0, 255,'; // Neon Purple
      }

      update() {
        // Upward drift
        this.y += this.speedY;
        this.x += this.speedX;

        // Twinkle effect (alpha pulsing)
        this.alpha += this.pulseSpeed * this.pulseDir;
        if (this.alpha > 0.8 || this.alpha < this.baseAlpha) {
          this.pulseDir *= -1;
        }

        // Mouse Repulsion (Deflection)
        if (mouse.x !== null && mouse.y !== null) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            // Push direction
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            
            this.x += forceDirectionX * force * 3;
            // Subtle upward boost when deflected
            this.y += forceDirectionY * force * 2 + (this.speedY * 0.5);
          }
        }

        // Reset if offscreen (top or sides)
        if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
          this.reset();
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `${this.color} ${this.alpha})`;
        
        // Add subtle bloom for larger stars
        if (this.size > 1.8) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = this.color.includes('171') ? '#ab00ff' : '#00f0ff';
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();
      }
    }

    // Populate particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Main animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw a subtle nebula background gradient
      const radialGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 10,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
      );
      radialGrad.addColorStop(0, '#0a0720'); // Dark bluish core
      radialGrad.addColorStop(0.6, '#040212'); // Transition
      radialGrad.addColorStop(1, '#02000a'); // Absolute deep space black
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid scanline overlay (futuristic aesthetic)
      ctx.fillStyle = 'rgba(0, 240, 255, 0.007)';
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      // Update and draw stars
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-20 pointer-events-none"
    />
  );
};

export default FloatingBackground;

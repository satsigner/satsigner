const swiper = new Swiper('.events', {
  effect: 'coverflow',
  centeredSlides: true,
  slidesPerView: 1,
  loop: true,
  //createElements: true,
  pagination: true,
  //autoplay: true,
  coverflowEffect: {
      rotate: 50,
      stretch: 50,
      depth: 300,
      modifier: 1,
      slideShadows: true,
  },
  breakpoints: {
    10: {
      slidesPerView: 2,
    }
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  }
});

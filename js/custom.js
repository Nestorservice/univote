/*
Template Name: Vogel - Social Network & Community HTML Template 
Author: Askbootstrap
Author URI: https://themeforest.net/user/askbootstrap
Version: 1.2
*/

(function ($) {
	"use strict"; // Start of use strict

	var Popular = {
		init: function () {
			this.Basic.init();
		},

		Basic: {
			init: function () {
				this.ListSlider();
			},

			// list_slider
			ListSlider: function () {
				$('.account-slider').slick({
					dots: false,
					arrows: false,
					infinite: false,
					speed: 300,
					slidesToShow: 4.2,
					slidesToScroll: 4.2,
					responsive: [
					  {
						breakpoint: 1024,
						settings: {
						  slidesToShow: 4.5,
						  slidesToScroll: 4.5,
						}
					  },
					  {
						breakpoint: 680,
						settings: {
						  slidesToShow: 2.5,
						  slidesToScroll: 2.5
						}
					  },
					  {
						breakpoint: 520,
						settings: {
						  slidesToShow: 3.5,
						  slidesToScroll: 3.5
						}
					  },
					  {
						breakpoint: 422,
						settings: {
						  slidesToShow: 2.5,
						  slidesToScroll: 2.5
						}
					  }
					]
				  });
			},
		}
	}
	jQuery(document).ready(function () {
		Popular.init();
	});

	// Dark Mode
	const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
	const currentTheme = localStorage.getItem('theme');
	if (currentTheme) {
		document.documentElement.setAttribute('class', currentTheme);

		if (currentTheme === 'dark') {
			toggleSwitch.checked = true;
		}
	}
	function switchTheme(e) {
		if (e.target.checked) {
			document.documentElement.setAttribute('class', 'dark');
			localStorage.setItem('theme', 'dark');
		}
		else {
			document.documentElement.setAttribute('class', 'light');
			localStorage.setItem('theme', 'light');
		}
	}
	toggleSwitch.addEventListener('change', switchTheme, false);

	// Bottom Navigation Mobile
	jQuery(document).ready(function () {
		var path = window.location.pathname;
		var page = path.split('/').pop();
		if(page === '') page = 'index.html';

		var navHtml = '<div class="bottom-nav-glass position-fixed bottom-0 w-100 d-flex d-xl-none justify-content-around align-items-center py-2" style="z-index: 1050; padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));">' +
			'<a href="index.html" class="text-decoration-none text-center flex-fill nav-bottom-item ' + (page === 'index.html' ? 'active' : '') + '">' +
				'<span class="material-icons d-block md-24">house</span>' +
				'<span class="small" style="font-size: 10px;">Accueil</span>' +
			'</a>' +
			'<a href="events.html" class="text-decoration-none text-center flex-fill nav-bottom-item ' + ((page === 'events.html' || page === 'event-detail.html' || page === 'candidate.html' || page === 'vote.html') ? 'active' : '') + '">' +
				'<span class="material-icons d-block md-24">how_to_vote</span>' +
				'<span class="small" style="font-size: 10px;">Événements</span>' +
			'</a>' +
			'<a href="social.html" class="text-decoration-none text-center flex-fill nav-bottom-item ' + ((page === 'social.html' || page === 'video-player.html') ? 'active' : '') + '">' +
				'<span class="material-icons d-block md-24">explore</span>' +
				'<span class="small" style="font-size: 10px;">Social</span>' +
			'</a>' +
			'<a href="pseudo.html" class="text-decoration-none text-center flex-fill nav-bottom-item ' + (page === 'pseudo.html' ? 'active' : '') + '">' +
				'<span class="material-icons d-block md-24">person</span>' +
				'<span class="small" style="font-size: 10px;">Profil</span>' +
			'</a>' +
		'</div>';

		$('body').append(navHtml);
	});

})(jQuery); // End of use strict

    // Draggable Dark Mode FAB
    jQuery(document).ready(function () {
        if ($('#darkModeFab').length === 0) {
            $('body').append('<div id="darkModeFab"><span class="material-icons" id="fabIcon">brightness_4</span></div>');
        }
        
        var fab = document.getElementById('darkModeFab');
        var icon = document.getElementById('fabIcon');
        
        // Update icon based on theme
        function updateFabIcon() {
            if(icon) {
                icon.textContent = document.documentElement.classList.contains('dark') ? 'brightness_7' : 'brightness_4';
            }
        }
        updateFabIcon();
        
        // Toggle theme on click
        $(fab).on('click', function(e) {
            if ($(this).hasClass('dragging')) return;
            var isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                document.documentElement.setAttribute('class', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('class', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateFabIcon();
            
            // Sync with desktop toggle if exists
            var deskToggle = document.getElementById('checkbox-desktop');
            if (deskToggle) deskToggle.checked = !isDark;
        });

        // Make it draggable for touch devices
        var isDragging = false;
        var startX, startY, initialX, initialY;
        
        if(fab) {
            fab.addEventListener('touchstart', function(e) {
                var touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                var rect = fab.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                isDragging = false;
            }, {passive: true});
            
            fab.addEventListener('touchmove', function(e) {
                var touch = e.touches[0];
                var dx = touch.clientX - startX;
                var dy = touch.clientY - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                    $(fab).addClass('dragging');
                    var newX = initialX + dx;
                    var newY = initialY + dy;
                    
                    // Bounds
                    newX = Math.max(0, Math.min(newX, window.innerWidth - fab.offsetWidth));
                    newY = Math.max(0, Math.min(newY, window.innerHeight - fab.offsetHeight));
                    
                    fab.style.left = newX + 'px';
                    fab.style.top = newY + 'px';
                    fab.style.bottom = 'auto';
                    fab.style.right = 'auto';
                    e.preventDefault();
                }
            }, {passive: false});
            
            fab.addEventListener('touchend', function(e) {
                setTimeout(function() { $(fab).removeClass('dragging'); }, 100);
            });
        }
    });

// --- CUSTOM CONFIGURATION FOR EACH INSECT TYPE ---
const INSECT_CONFIG = {
	// INSECT:       Size (px) | Movement Speed (CSS transition) | Min Rest Time (ms) | Max Rest Time (ms)
	'cockroach.png': { size: '100px', speed_css: '2s', min_rest: 1000, max_rest: 3000 }, // COCKROACH: Largest (45px)
	'ant.png':       { size: '10px', speed_css: '2s', min_rest: 1000, max_rest: 3000 }, // ANT: Smallest (20px)
	'spider.png':    { size: '50px', speed_css: '5s', min_rest: 3000, max_rest: 8000 }, // SPIDER: Slowest movement
	'fly.png':       { size: '25px', speed_css: '0.5s', min_rest: 500, max_rest: 1500 }  // FLY: Fastest movement
};

// --- QUANTITY CONFIGURATION ---
const BASE_COUNT = 2; // Set Cockroach base quantity

const INSECT_COUNTS = {
	'cockroach.png': BASE_COUNT,           // Cockroach: 10 (Base)
	'ant.png':       BASE_COUNT * 10,      // Ant: 10 times Cockroach (100)
	'spider.png':    BASE_COUNT * 2,       // Spider: 2 times Cockroach (20)
	'fly.png':       BASE_COUNT * 4        // Fly: 4 times Cockroach (40)
};

const INSECT_TYPES = Object.keys(INSECT_CONFIG);
let insectIdCounter = 0;

// Create and add insects to the container according to the predefined quantity
INSECT_TYPES.forEach(imagePath => {
	const count = INSECT_COUNTS[imagePath];
	const config = INSECT_CONFIG[imagePath];
	
	for (let i = 0; i < count; i++) {
		const $insectDiv = $('<div class="insect" id="insect-' + insectIdCounter + '"></div>');
		
		// Apply custom properties
		$insectDiv.css({
			'background-image': 'url(' + imagePath + ')',
			'width': config.size,
			'height': config.size,
			'transition': `transform ${config.speed_css} linear, left ${config.speed_css} linear, top ${config.speed_css} linear`
		});

		// Save rest time to data-attribute for moveInsect function
		$insectDiv.data('min_rest', config.min_rest);
		$insectDiv.data('max_rest', config.max_rest);
		
		$('#insect-container').append($insectDiv);
		insectIdCounter++;
	}
});


// Function to move the insect to a random position
function moveInsect(insectId) {
	const $insect = $('#' + insectId);
	
	// Read rest time from data-attribute
	const minRest = $insect.data('min_rest') || 1000;
	const maxRest = $insect.data('max_rest') || 3000;
	
	const maxWidth = $(window).width() - $insect.width();
	const maxHeight = $(window).height() - $insect.height();

	const newX = Math.random() * maxWidth;
	const newY = Math.random() * maxHeight;
	
	const currentLeft = parseFloat($insect.css('left')) || 0;
	const currentTop = parseFloat($insect.css('top')) || 0;

	const angle = Math.atan2(newY - currentTop, newX - currentLeft) * (180 / Math.PI) + 90; 

	$insect.css({
		'left': newX + 'px',
		'top': newY + 'px',
		'transform': 'rotate(' + angle + 'deg)'
	});
	
	// Calculate random rest time based on configuration
	const randomTime = Math.random() * (maxRest - minRest) + minRest; 

	// Repeat the function after a random time
	setTimeout(function() {
		moveInsect(insectId);
	}, randomTime);
}

// Initialize starting position and start movement for all insects
$(document).ready(function() {
	// Total number of insects created
	const totalInsects = insectIdCounter;
	
	for (let i = 0; i < totalInsects; i++) {
		$('#insect-' + i).css({
			'left': Math.random() * $(window).width() + 'px',
			'top': Math.random() * $(window).height() + 'px'
		});
		moveInsect('insect-' + i);
	}
});
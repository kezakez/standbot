// detect if you are sitting in front of the robot for a period of time fade a light to red to warn you to move

const five = require("johnny-five");
const board = new five.Board({port: process.argv[2] || `COM3`});
const stdin = process.openStdin();
const pixel = require("node-pixel");
let exiting = false;
let strip = null;

board.on("ready", function () {

    strip = new pixel.Strip({
        data: 13,
        length: 2,
        board: this,
        controller: "FIRMATA"
    });

    // using pin rather than button as button does not raise events
    var button = new five.Pin(`A7`);
    function checkButtonState() {
        button.query((state) => {
            if (state.value === 0) {
                console.log(`Resetting here status`);
                resetReadings();
            }
        });
    }

    new five.Proximity({
        freq: 1000,
        controller: "HCSR04",
        pin: 10
    }).on("data", function () {
        if (exiting) return;

        checkButtonState();

        console.log(`detected cm: ${this.cm}`);
        const here = isHere(this.cm);

        const allReadings = storeReading(here);
        const hereWindowPercent = calculateHerePercentage(allReadings);
        console.log(`Here percentage ${hereWindowPercent}`);

        const beenHereSince = calculateHereSince(hereWindowPercent);

        const numberOfMinutes = ((new Date() - beenHereSince)/1000)/60;
        console.log(`Been here since ${beenHereSince} minutes: ${numberOfMinutes}`);

        const healthySitTime = 25;
        const transitionPercentage = numberOfMinutes/healthySitTime;

        const hexColour = calculateHexColour(transitionPercentage);
        strip.pixel(0).color(hexColour);
        strip.show();
    });

    function isHere(numberOfCentimetres) {
        const hereThreshold = 100;

        return numberOfCentimetres < hereThreshold;
    }

    const rollingWindowSize = 10;
    const readings = new Array(rollingWindowSize);
    function storeReading(isHere) {
        readings.push(isHere);
        if (readings.length > rollingWindowSize) {
            readings.splice(0, 1);
        }
        return readings;
    }

    function resetReadings() {
        readings.fill(0);
    }

    function calculateHerePercentage(allReadings) {
        const hereReadings = allReadings.filter(item => item).length;
        return hereReadings / readings.length;
    }

    let beenHereSince = new Date();
    function calculateHereSince(herePercentage) {
        const here = herePercentage > 0.25;
        if (!here) {
            beenHereSince = new Date();
        }
        return beenHereSince;
    }

    function calculateHexColour(percentageTransition) {
        if (percentageTransition < 0) {
            percentageTransition = 0;
        }
        if (percentageTransition > 1) {
            percentageTransition = 1;
        }

        const total = 255;
        const greenComponent = total - Math.ceil(total * percentageTransition);
        const redComponent = total - greenComponent;
        const r = ("00" + redComponent.toString(16)).substr(-2);
        const g = ("00" + greenComponent.toString(16)).substr(-2);
        const b = `00`;
        return `#${r}${g}${b}`;
    }

    stdin.on('keypress', function (chunk, key) {
        handleKeyboardInput(key);
    });

    function handleKeyboardInput(key) {
        if (key) {
            switch (key.name) {
                case "up":
                    break;
                case "down":
                    break;
                case "return":
                case "space":
                    gracefulClose();
                    break;
            }
        }
    }
});

function gracefulClose() {
    console.log(`cleaning up`);
    exiting = true;
    if (strip) {
        strip.off();
        strip.show();
    }
    // allow for some time to turn it off
    setTimeout(() => process.exit(), 100);
}

board.on("exit", function () {
    console.log(`exited`);
});
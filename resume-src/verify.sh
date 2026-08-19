#!/bin/sh
# Build BOTH resumes from resume-src/resume.html and check each one.
#
#   live-portfolio/PoncedeLeon-Resume.pdf   SF Pro   — what the website links
#   resume-src/PoncedeLeon-CV.pdf           Inter    — what goes to employers
#
# Run from the repo root:  sh resume-src/verify.sh
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SITE="live-portfolio/PoncedeLeon-Resume.pdf"
CV="resume-src/PoncedeLeon-CV.pdf"

NAME="Santiago (Tigo) Ponce de Leon"
SUBJ="Product design engineer - research and product thinking through to React and Swift in production"
KEYS="Product Design, UX Design, Product Designer, UX Engineer, User Research, Usability Testing, Interaction Design, Design Systems, Wireframing, Prototyping, Figma, React, Swift, SwiftUI, iOS, HTML, CSS, JavaScript, Python, Git, Front-End Development"

render() {  # render <url-query> <out>
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --run-all-compositor-stages-before-draw --virtual-time-budget=3000 \
    --print-to-pdf="$2" "file://$PWD/resume-src/resume.html$1" 2>/dev/null
}

render "?v=sf" "$SITE"
render ""      "$CV"

python3 resume-src/stamp.py "$SITE" "$NAME - Resume" "$NAME" "$SUBJ" "$KEYS"
python3 resume-src/stamp.py "$CV"   "$NAME - Resume" "$NAME" "$SUBJ" "$KEYS"

# both builds are checked even if the first one fails, so one broken variant
# never hides the state of the other
set +e
echo "website copy (SF Pro, human readers):"
python3 resume-src/check.py "$SITE" drawn;  A=$?
echo
echo "applications copy (Inter, scanners):"
python3 resume-src/check.py "$CV" text;     B=$?
echo
echo "----- text a scanner reads out of the applications copy -----"
python3 resume-src/pdftext.py "$CV"

[ $A -eq 0 ] && [ $B -eq 0 ] || { echo; echo "*** one or both builds FAILED ***"; exit 1; }

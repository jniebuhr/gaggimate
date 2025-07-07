# 🚀 GitHub Pages Deployment Instructions

Follow these steps to deploy your GaggiMate firmware flasher to GitHub Pages:

## 📋 Prerequisites

1. GitHub account
2. Repository pushed to GitHub
3. Firmware files built and copied to `docs/flasher/firmware/`

## 🔧 Setup Steps

### 1. Enable GitHub Pages

1. Go to your GitHub repository
2. Click on **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Under **Source**, select:
   - **Deploy from a branch**
   - **Branch:** `main` (or your default branch)
   - **Folder:** `/docs`
5. Click **Save**

### 2. Wait for Deployment

- GitHub will automatically build and deploy your site
- This usually takes 1-5 minutes
- You'll see a green checkmark when it's ready

### 3. Access Your Flasher

Your firmware flasher will be available at:
```
https://yourusername.github.io/repository-name/flasher/
```

**Example:**
- Username: `johndoe`
- Repository: `gaggimate`
- Flasher URL: `https://johndoe.github.io/gaggimate/flasher/`

## 🔄 Updating Firmware

### Manual Update
```bash
# Build new firmware
platformio run -e display
platformio run -e controller

# Copy to docs directory
copy .pio\build\display\firmware.bin docs\flasher\firmware\gaggimate-display.bin
copy .pio\build\controller\firmware.bin docs\flasher\firmware\gaggimate-controller.bin

# Commit and push
git add docs/flasher/firmware/
git commit -m "Update firmware to version X.X.X"
git push
```

### Automatic Update (GitHub Actions)
The included GitHub Actions workflow will automatically:
- Build firmware when you push code changes
- Update the firmware files in the docs directory
- Commit and push the updated files

## 🛠️ Customization

### Update Branding
Edit `docs/flasher/index.html` to:
- Change colors/styling
- Update text and descriptions
- Add your logo
- Modify instructions

### Add Firmware Versions
Edit the manifest files to include version information:
- `docs/flasher/manifests/display-manifest.json`
- `docs/flasher/manifests/controller-manifest.json`

## 🔒 Security Notes

- GitHub Pages serves over HTTPS automatically
- ESP Web Tools requires HTTPS for Web Serial API
- All flashing happens locally in the user's browser
- No sensitive data is transmitted

## 📱 Testing

Before sharing publicly:

1. **Test locally** using the Python server
2. **Test on GitHub Pages** with a real board
3. **Verify both firmware types** work correctly
4. **Check on different browsers** (Chrome, Edge)

## 🐛 Common Issues

### Pages Not Working
- Check that GitHub Pages is enabled
- Verify the `/docs` folder is selected
- Wait a few minutes for deployment
- Check for any build errors in Actions tab

### Flasher Not Loading
- Ensure all files are in correct locations
- Check browser console for errors
- Verify firmware files exist and aren't corrupted

### ESP Web Tools Errors
- Must use Chrome 89+ or Edge 89+
- Ensure HTTPS connection (GitHub Pages provides this)
- Check that Web Serial API is enabled

## 🎉 Success!

Once deployed, users can:
- Visit your flasher URL
- Flash their boards directly from the browser
- No need to install Arduino IDE or PlatformIO
- Works on any computer with Chrome/Edge

Share your flasher URL with the GaggiMate community! 🚀

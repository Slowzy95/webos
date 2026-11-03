# Windows theme assets

WebOS is an independent browser-based desktop, not Microsoft Windows. Its applications are web applications; theming does not install Windows or enable native Windows executables.

## Wallpapers and system icons

Original-image wallpaper sources and Windows system resource icons are from the unofficial archive at https://github.com/bartekl1/windows-ui-assets (retrieved November 3, 2026). The archive describes extraction from Windows installation media or installed systems; Microsoft content remains subject to Microsoft's original terms and is not claimed as public domain.

- Windows 11: `Wallpapers/Windows 11/Desktop/Windows/img0.jpg`.
- Windows 10: `Wallpapers/Windows 10/Desktop/Windows/img0.jpg`.
- Windows 7: `Wallpapers/Windows 7/Desktop/Windows/img0.jpg`.
- Windows XP: `Wallpapers/Windows XP/Desktop/Bliss.bmp`.
- The local WebP versions are resized/compressed from these images, not procedural recreations.
- Version-specific Control Panel, Recycle Bin and folder icons are from the corresponding `shell32.dll` or `shell32.dll.mun` icon resources; Windows 7 Control Panel and Recycle Bin use `imageres.dll` resources 27 and 55.
- Microsoft Edge's logo, used for the Windows 10/11 browser shortcut, is from https://commons.wikimedia.org/wiki/File:Microsoft_Edge_logo_(2019).svg (download: https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg).
- Windows 98 uses its classic teal desktop color and icon images from https://github.com/AlexBSoft/win95.css/tree/master/assets/icons. Upstream project: https://github.com/AlexBSoft/win95.css.
- Custom WebOS applications retain their own branding when no equivalent Windows system application exists. An Assistant IA or a YouTube hub is not represented as an original XP/7 system component.

## Search reader

The optional simplified result reader sends only the typed query to the public Bing RSS endpoint, read through https://r.jina.ai/. No local API key, service login cookie or assistant conversation is included. The reader displays up to ten results with attribution; it is not Google, does not solve CAPTCHAs, and is dependent on upstream availability and rate limits. The full official engines remain selectable.

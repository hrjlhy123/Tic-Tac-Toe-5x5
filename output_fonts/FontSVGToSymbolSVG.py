import xml.etree.ElementTree as ET

# 读取 font.svg 文件
input_svg = "CascadiaCodeNF.svg"  # 替换成你的 SVG 文件路径
output_svg = "CascadiaCodeNF_symbol.svg"

# 解析 XML 结构
tree = ET.parse(input_svg)
root = tree.getroot()

# 定义新的 SVG 结构
new_svg = ET.Element("svg", {
    "xmlns": "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink"
})

# 查找 <font> 标签并提取所有 <glyph>
font_elem = root.find(".//{http://www.w3.org/2000/svg}font")

if font_elem is not None:
    for glyph in font_elem.findall(".//{http://www.w3.org/2000/svg}glyph"):
        glyph_name = glyph.get("glyph-name", "unknown")
        glyph_path = glyph.get("d", "")

        # if glyph_path:  # 过滤掉没有路径的 glyph
        symbol = ET.Element("symbol", {
            "id": f"glyph-{glyph_name}",
            "viewBox": "0 0 1200 1420"  # 你可以根据需要调整
        })
        path = ET.Element("path", {"d": glyph_path, "fill": "black"})
        symbol.append(path)
        new_svg.append(symbol)

# 写入新的 SVG 文件
tree = ET.ElementTree(new_svg)
tree.write(output_svg, encoding="utf-8", xml_declaration=True)

print(f"转换完成，生成的文件: {output_svg}")
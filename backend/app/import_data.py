import asyncio
import csv
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import save_listing, init_db

# Your CSV data
csv_data = '''1,https://www.zoopla.co.uk/for-sale/details/70556558/,1 bed flat,"Kennoway Drive, Glasgow G11","£120,000",55.871395,-4.319153,"[""https://lid.zoocdn.com/u/1200/900/013be5c43a8b1d89d9532fa5af5c906d0c7b202b.jpg:p"",""https://lid.zoocdn.com/u/1200/900/3bd4aaa0c84616d3260463d43a1a1a910eec4730.jpg:p"",""https://lid.zoocdn.com/u/1200/900/12f507d1c5e51afb6b7dfb1fd343ee3a64944564.jpg:p"",""https://lid.zoocdn.com/u/1200/900/87d63acf13273eff7bb3218894201761ea6d5c9a.jpg:p"",""https://lid.zoocdn.com/u/1200/900/38443d3a4f41fa58ce54c7bb7be7b8a66321a969.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/ff3ee00ee17e8accaf5cd5ad9d1303d0a8813daf.jpg:p""]",1,1,Flat
2,https://www.zoopla.co.uk/for-sale/details/70452399/,1 bed flat ,"Dumbarton Road, Partick, Glasgow G11","£150,000",55.87095,-4.306248,"[""https://lid.zoocdn.com/u/1200/900/14cb003bc66d0a23a6272684418dbdad935c0565.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/47bdd477284fd938323adfdc745ab724ae0d7b44.jpg:p"", ""https://lid.zoocdn.com/u/768/576/aba78b2fcbdcf072edabd1c8fec22a5bee5a5817.jpg:p"", ""https://lid.zoocdn.com/u/768/576/137fc100a46d40b191ea6851ca91189df4f981aa.jpg:p"", ""https://lid.zoocdn.com/u/768/576/980a587178117b2393632e01231525e933b159fa.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/3d395b1f35ed90f407cf4ed51a6a5a15cb8e54ff.png:p""]",1,1,Flat
3,https://www.zoopla.co.uk/for-sale/details/70510558/,1 bed flat,"1/2 Dumbarton Road, Partick, Glasgow G11","£155,000",55.870739,-4.299939,"[""https://lid.zoocdn.com/u/1200/900/363c08aad5de6eb7acb9d5091a7034210fd7d142.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/a4a850a46113ac68f3d13f67516a272e6459e4b2.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/cc26099ee9e741fbe234dc9883316eee88032a40.jpg:p"", ""https://lid.zoocdn.com/u/768/576/84eb66551c7ac4136eb214325caec0af19a45deb.jpg:p"", ""https://lid.zoocdn.com/u/1024/768/aa08a8578d2cdab3af621085d1076e628f8f29a1.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/39d12d2d98f9e4a1c6991cd1dcd1b62578929b9a.jpg:p""]",1,1,Flat
4,https://www.zoopla.co.uk/for-sale/details/70561169/,1 bed flat,"Anderson Street, Glasgow G11","£170,000",55.8703,-4.30617,"[""https://lid.zoocdn.com/u/1200/900/4e7dba9252fcf9aaafb79ec40eebc714e8718a32.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/5c470192cfceeebf5254ed042446e46b8a87eef5.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/8dc12cdd30c84538758ab24fea338bbdffb5d026.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/1011d3988ba7cb7a55dbcd28124b6035c48cfb40.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/5bf3248ae9b0ea2159c44465ae5f659e23ae34b3.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/19fee2b0e0b753c6eb2a61b699e00eea575df9ac.png:p""]",1,1,Flat
5,https://www.zoopla.co.uk/for-sale/details/70584471/,1 bed flat,"Meadowside Quay Walk, Glasgow Harbour, Glasgow G11","£145,000",55.868828,-4.320156,"[""https://lid.zoocdn.com/u/768/576/fddfae9b43986446c108ce9bab4f5e022b4a1e94.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/680708d3e8a402a6fb64689a418a43baec5009ce.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/9086d5831360900e066836dae36b467a806df2b2.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/1dd71ee2a0a3ace7e600228bf9ec60b5e28348e4.jpg:p"", ""https://lid.zoocdn.com/u/1024/768/1bdf9db5825f8f0da68116c8fa9a2fa2ac2a7f2a.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/db703d09ac6f5db5f9b4d2fc6020b0c378e970b2.jpg:p""]",1,1,Flat
6,https://www.zoopla.co.uk/new-homes/details/67516341/,1 bed flat,"3/2 Burgh Hall Street, Glasgow G11","£239,995 ",55.871349,-4.310199,"[""https://lid.zoocdn.com/u/768/576/b0f4d38856af4f24974b2cd4b11ce142819d56ab.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/a664803f2b41407b904e3443f9bb99adc91ecc4c.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/aaddd8e4d447ad94a95d839efe7b490c2489a70d.jpg:p"", ""https://lid.zoocdn.com/u/768/576/aca9a5bc9d284f48876ee076a408af761b3bbf0f.jpg:p"", ""https://lid.zoocdn.com/u/768/576/49c7c7fbeab2fde47c31b8cb93302fc7120773cd.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/49476393c30651757347ea83d6fcb0254dee8191.jpg:p""]",1,1,Flat
7,https://www.zoopla.co.uk/for-sale/details/70458075/,1 bed flat,"Partickhill Road, Glasgow G11","£210,000",55.873819,-4.303662,"[""https://lid.zoocdn.com/u/768/576/2456c1495d409a58555a1bc95ce773ae7a7ec597.jpg:p"", ""https://lid.zoocdn.com/u/768/576/dcb9986d79ecdb87fb4a17eb6de6bfaad08715b6.jpg:pv"", ""https://lid.zoocdn.com/u/1024/768/38351d359806e5f6930fdcf81b75e710b0ecc5ff.jpg:p"", ""https://lid.zoocdn.com/u/768/576/53abad02f13f3c91113dfe9167ed61019614024e.jpg:p"", ""https://lid.zoocdn.com/u/1024/768/41bd97f897c9bc62bfc6591482efb1321409d611.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/195641eb4c822768857c2b7910660b32c4a86dd4.jpg:p""]",1,1,Flat
8,https://www.zoopla.co.uk/for-sale/details/68141370/,1 bed flat,"Thornwood Avenue, Glasgow G11","£110,000",55.873446,-4.317842,"[""https://lid.zoocdn.com/u/1200/900/27da9f066a33a624de5dbf625ef64a4a9447478f.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/79237153446b0436a0623c3aba629cd73c591bca.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/8542e650645ff8f8a749524aef825ac11d7a03a6.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/aa4d366b6a777bb7baaf310def0448c7c3ad2720.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/95194df994dbb208e565b25023ac7bde5975046b.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/d0ef94fd4fa15d97b682773b40e8d9e748994514.png:p""]",1,1,Flat
9,https://www.zoopla.co.uk/for-sale/details/70641308/,1 bed flat,"Incholm Street, Flat 2/2, Thornwood, Glasgow G11","£99,000",55.87182,-4.328456,"[""https://lid.zoocdn.com/u/1200/900/8fa50ca1698ccb9149d8496fb0524884911322e7.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/14b48a6a20190781e9e521abd820abf1e7785df6.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/37c282f2bc375106f196250c7cc88c970d3f2837.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/795ab12d75b633dd091ab2c2b4e5aef8305789a3.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/60feb077a85e22d3c397bb4c565b401c81481d3b.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/92103de73fc49cd5296a6481ad0a74767832be75.jpg:p""]",1,1,Flat
10,https://www.zoopla.co.uk/for-sale/details/70136316/,2 bed flat,"Broomhill Path, Broomhill, Glasgow G11","£130,000",55.873841,-4.325523,"[""https://lid.zoocdn.com/u/1200/900/2a58e553f3a00ca429c881383312b613594f76fd.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/33dfa686f14ec640d4a52877329a98df88188c11.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/774d176f8b87baf17144ceafaae881a0df6c1a35.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/9542f0e379ae551b5efe272906133e1106fd35ae.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/3a7621f3541bfc1005f34591d5a868eb4306bcc8.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/b0c0a7093f57ebd15100a117ce000eb882fedb6b.jpg:p""]",2,1,Flat
11,https://www.zoopla.co.uk/for-sale/details/70258003/,2 bed flat,"White Street, Partick, Glasgow G11","£300,000",55.872794,-4.30089,"[""https://lid.zoocdn.com/u/768/576/04f367b756b2472bc947ce1651b9d57f1c3f0c30.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/af5c49c98b9485bb679df24371bba6959f2aa251.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/24da11d5e47ac855ee994386f69e886342ac3f82.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/78ec46a5be92798dfbfe91453f7c8a763eadcaec.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/3a78096604eb06e1c39d2c035089348b02338418.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/36340bb5572167fa5a04f9f5db944b24e871213f.jpg:p""]",2,1,Flat
12,https://www.zoopla.co.uk/for-sale/details/70604737/,2 bed flat,"276 Crow Road, Broomhill G11","£225,000 ",55.876663,-4.320433,"[""https://lid.zoocdn.com/u/1200/900/6fa0723af17694b15bfe0c702afff34be0175a54.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/d5896898929790a1fc2d6fd16204815f47d920e2.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/2692bd785022d02721b14c7ddd6eeac76b96948c.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/db171299370a5aee02f878b8aaad1b54826ca22d.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/d4944aab37faac6cf094eb4aa08c45b4faec9dae.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/52a5b425d456070e56357df9db5c1408b758c444.jpg:p""]",2,1,Flat
13,https://www.zoopla.co.uk/for-sale/details/69994487/,2 bed flat,"Castlebank Place, Glasgow Harbour, Glasgow G11","£240,000",55.86904,-4.299293,"[""https://lid.zoocdn.com/u/1200/900/18d9190acf906c1483790835779fbe2563333dfa.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/398628d173cb26885fc847e671b085dbf167ce77.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/59205aa8af34ba991985df4bb782568600a73235.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/024d9f35a2f5965444e3b450939f16975c35c806.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/2e3b5ea02631062fd359c6890de6ced7ff887da2.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/52fa18abdec2e897c3798a3e35544d52976468a6.jpg:p""]",2,2,Flat
14,https://www.zoopla.co.uk/for-sale/details/70224016/,2 bed flat,"Meadowside Quay Square, Glasgow Harbour, Glasgow G11","£190,000 ",55.868469,-4.316778,"[""https://lid.zoocdn.com/u/1200/900/a9fe161272f1e74e8cfbe110c429694a6aee5019.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/e918f5c4c702cbe44808933dbe2fa7dd5fc74747.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/e029a25794872bb45bf422aa338dd59ee8fc4ab7.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/99b15f96b5a187124d817573cd59c2c5298ce885.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/54f15f5a20b3aad73054a8d3a37a702f329195f9.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/8891e5da17812c2d5f592fc86a269bd9deb2f798.jpg:p""]",2,2,Flat
15,https://www.zoopla.co.uk/new-homes/details/66086937/,3 bed flat,"Burgh Hall Street, Partick, Glasgow G11","£417,000 ",55.871349,-4.310199,"[""https://lid.zoocdn.com/u/1200/900/308b6919577d851693cf82e5c7f9c9673761fdcf.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/5352a334a6713d88d81b818a00363ae6fc8e96d1.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/dbba4052c9eb26d6b8d54d3c3c7108fe8feac59f.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/c5699d5570782a165f95057433ccda58f7e524dd.jpg:p"", ""https://lid.zoocdn.com/u/1200/900/49c7c7fbeab2fde47c31b8cb93302fc7120773cd.jpg:p""]","[""https://lid.zoocdn.com/u/1200/900/6fd45ca7dadeb7db8114d817e6771bb0d502b917.jpg:p""]",3,2,Flat'''

def clean_json_string(json_str):
    """Clean and parse JSON string from CSV"""
    # Remove outer quotes if present
    if json_str.startswith('"') and json_str.endswith('"'):
        json_str = json_str[1:-1]

    # Fix double quotes
    json_str = json_str.replace('""', '"')

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"String: {json_str}")
        return []

def parse_csv_row(row):
    """Parse a single CSV row into a listing dictionary"""
    # CSV format: id,listing_link,title,address,price,latitude,longitude,image_urls,floorplan_urls,bedrooms_count,bathrooms_count,property_type

    return {
        "listing_link": row[1],
        "title": row[2],
        "address": row[3],
        "price": row[4].strip(),  # Remove trailing spaces
        "latitude": float(row[5]),
        "longitude": float(row[6]),
        "image_urls": clean_json_string(row[7]),
        "floorplan_urls": clean_json_string(row[8]),
        "bedrooms_count": int(row[9]),
        "bathrooms_count": int(row[10]),
        "property_type": row[11]
    }

async def import_listings():
    """Import all listings from CSV data"""
    print("🔧 Initializing database...")
    await init_db()

    print("📊 Parsing CSV data...")

    # Parse CSV data
    from io import StringIO
    csv_reader = csv.reader(StringIO(csv_data))

    success_count = 0
    error_count = 0

    for row in csv_reader:
        try:
            listing_data = parse_csv_row(row)

            print(f"📝 Processing: {listing_data['title']}")

            # Save to database
            success = await save_listing(listing_data)

            if success:
                success_count += 1
                print(f"✅ Added: {listing_data['title']}")
            else:
                error_count += 1
                print(f"❌ Failed: {listing_data['title']}")

        except Exception as e:
            error_count += 1
            print(f"❌ Error processing row: {e}")
            print(f"   Row: {row}")

    print(f"\n🎉 Import complete!")
    print(f"✅ Successfully imported: {success_count} listings")
    print(f"❌ Failed: {error_count} listings")

    return success_count

if __name__ == "__main__":
    result = asyncio.run(import_listings())
    print(f"\nFinal result: {result} listings imported")
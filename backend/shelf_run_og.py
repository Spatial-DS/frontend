import pandas as pd
import numpy as np
import pypandoc

#Load in datasets
label_path = "NLB update\\Filiters.xlsx"
dataset_path = "NLB update\\CY2023 Loans and Return Collection Data.xlsx"
holdings_path= "NLB update\\holdings.xlsx"

out_path="NLB update\\shelfrun_final.docx"    # for final shelf run word doc

constant=0.75 
no_of_months=12

label_df = pd.read_excel(label_path, dtype=str, sheet_name='Filters')
shelf_df= pd.read_excel(label_path, dtype=str, sheet_name= 'Shelf Run')
data_df = pd.read_excel(dataset_path)
holding_df = pd.read_excel(holdings_path)

#Calulate holdings
holding_df['holdings']=holding_df['Target end state collection'] + holding_df['Retained']

#Fn to generate holdings template
def hold_temp(shelf_df):
    holding_template=shelf_df[['Category','Sub category']].copy()
    holding_template['Target end state collection']=holding_template['Retained']=''

    # final_path="holdings template.xlsx"
    # holding_template.to_excel(final_path, index=False)
    return holding_template


#Managing datatypes
def set_to_float(df_col):
    return pd.to_numeric(df_col, errors='coerce')

def set_to_str(df,col):
    return df[col].astype(str).str.strip()

data_df['Item DDC Class'] = data_df['Item DDC Class'].apply(lambda x: '000' if str(x).strip() == '0' else x)
label_df['Item DDC Class'] = label_df['Item DDC Class'].apply(lambda x: '000' if str(x).strip() == '0' else x)

#shelf df
shelf_df['Avg Vol per m']=set_to_float(shelf_df['Avg Vol per m'])
shelf_df['No. of Tiers']=set_to_float(shelf_df['No. of Tiers'])
#data df
data_df['Loans and Renewals']=set_to_float(data_df['Loans and Renewals'])
data_df['Returns']=set_to_float(data_df['Returns'])
data_df['Potential RTOB Required']=set_to_float(data_df['Potential RTOB Required'])
#holdings df
holding_df['Target end state collection']=set_to_float(holding_df['Target end state collection'])
holding_df['Retained']=set_to_float(holding_df['Retained'])
holding_df['holdings']=set_to_float(holding_df['holdings'])

#Creating Cat
def create_cat(df):
    df['Cat'] = df['Category'].astype(str).str.strip() + "*" + df['Sub category'].astype(str).str.strip()

create_cat(label_df)
create_cat(shelf_df)
create_cat(holding_df)

#preparing filiter
def pass_filiter(row,filt):
    for col, filt_val in filt.items():
        if col in ["Item Language","Item Age Lvl","Item Fiction Tag","Item Subject Suffix","Item DDC Class","Item Collection Code"]:
            filt_val = str(filt_val).strip()
            data_val = str(row[col]).strip()
            if filt_val == '':
                continue
            elif filt_val.startswith('NOT IN'):
                exclude = [x.strip() for x in filt_val[7:].split(',')]
                if data_val in exclude:
                    return False
            elif ' or ' in filt_val:
                options = [x.strip() for x in filt_val.split(' or ')]
                if data_val not in options:
                    return False
            else:
                if data_val != filt_val:
                    return False
    return True

def assign_cat(row, filters):
    for f in filters:
        if pass_filiter(row, f):
            return f['Cat']
    return None

#Assigning filiters
label_df = label_df.fillna('').astype(str).applymap(str.strip)
filters = label_df.to_dict(orient='records')

# Assign Cat column
data_df['Cat'] = data_df.apply(lambda row:assign_cat(row, filters), axis=1)

#flag out those without/multiple "Sub category"
empty_rows = (
    data_df[data_df['Cat'].isna()]
    .groupby(
        [
            'Item Language',
            'Item Age Lvl',
            'Item Fiction Tag',
            'Item Subject Suffix',
            'Item DDC Class',
            'Item Collection Code'
        ],
        dropna=False   # keep rows with None if needed
    )
    .sum(numeric_only=True)
    .reset_index()
)

multiple_cat = (
    data_df[data_df['Cat'].str.count('/*') > 1]
    .groupby(
        [
            'Item Language',
            'Item Age Lvl',
            'Item Fiction Tag',
            'Item Subject Suffix',
            'Item DDC Class',
            'Item Collection Code'
        ],
        dropna=False   # keep rows with None if needed
    )
    .sum(numeric_only=True)
)

#Collated
collated = data_df.groupby('Cat', as_index=False).agg({
    'Loans and Renewals': 'sum',
    'Returns': 'sum',
    'Potential RTOB Required': 'sum'
})

#Draw holdings and avg vol per meter, tiers
finaldf = collated.merge(shelf_df, on='Cat', how='left')
finaldf = finaldf.merge(holding_df, on='Cat', how='left')

#Hardcoding for spine/front facing (ik i did it in a dumb way)
#Baby - English
row1 = finaldf.loc[finaldf['Cat'] == "Children's Early Literacy Collection*Early Literacy (Baby) - English"]
if not row1.empty:
    #Spine row
    spine_row=row1.copy()
    spine_row['Loans and Renewals']=spine_row['Loans and Renewals']*0.8
    spine_row['Returns']=spine_row['Returns']*0.8
    spine_row['Potential RTOB Required']=spine_row['Potential RTOB Required']*0.8
    spine_row['holdings']=spine_row['holdings']*0.8
    spine_row['Cat'] = "Children's Early Literacy Collection*Early Literacy (Baby) - English (Spine)"
    #Front row
    front_row=row1.copy()
    front_row['Loans and Renewals']=front_row['Loans and Renewals']*0.2
    front_row['Returns']=front_row['Returns']*0.2
    front_row['Potential RTOB Required']=front_row['Potential RTOB Required']*0.2
    front_row['holdings']=front_row['holdings']*0.2
    front_row['Cat'] = "Children's Early Literacy Collection*Early Literacy (Baby) - English (Front)"
    #Remove and replace rows
    finaldf = finaldf.drop(row1.index)
    finaldf=pd.concat([finaldf,spine_row,front_row])

#Baby - Language
row2 = finaldf.loc[finaldf['Cat'] == "Children's Early Literacy Collection*Early Literacy (Baby) - Languages"]
if not row2.empty:
    #Spine row
    spine_row=row2.copy()
    spine_row['Loans and Renewals']=spine_row['Loans and Renewals']*0.8
    spine_row['Returns']=spine_row['Returns']*0.8
    spine_row['Potential RTOB Required']=spine_row['Potential RTOB Required']*0.8
    spine_row['holdings']=spine_row['holdings']*0.8
    spine_row['Cat'] = "Children's Early Literacy Collection*Early Literacy (Baby) - Languages (Spine)"
    #Front row
    front_row=row2.copy()
    front_row['Loans and Renewals']=front_row['Loans and Renewals']*0.2
    front_row['Returns']=front_row['Returns']*0.2
    front_row['Potential RTOB Required']=front_row['Potential RTOB Required']*0.2
    front_row['holdings']=front_row['holdings']*0.2
    front_row['Cat'] = "Children's Early Literacy Collection*Early Literacy (Baby) - Languages (Front)"
    finaldf = finaldf.drop(row2.index)
    finaldf=pd.concat([finaldf,spine_row,front_row])


finaldf["Vol on shelf"]=finaldf['holdings']-((finaldf['Loans and Renewals']*constant)/no_of_months)+((finaldf['Returns']*constant)/no_of_months)
finaldf["meter run"]=finaldf["Vol on shelf"]/finaldf["Avg Vol per m"]
finaldf["Shelf run"]=finaldf["meter run"]/finaldf["No. of Tiers"]

# Apply fix only to selected columns
cols = ["Cat"]

# Replace common encoding errors for apostrophes
def fix_apostrophes(s):
    if pd.isna(s):
        return s
    s = str(s)
    # fix garbled sequences and curly quotes
    s = (s.encode("latin1", errors="ignore")
           .decode("utf-8", errors="ignore"))
    s = s.replace("’", "'").replace("‘", "'")
    return s

for c in cols:
    finaldf[c] = finaldf[c].apply(fix_apostrophes)


finaldf[['Category', 'Sub category']] = finaldf['Cat'].str.split('*', n=1, expand=True)

#coverting to markdown and then Word Document
df_shelfrun=finaldf[['Category','Sub category','meter run','No. of Tiers','Shelf run']]

category_dict = (
    df_shelfrun.groupby("Category")[["Sub category",'meter run','No. of Tiers', "Shelf run"]]
    .apply(lambda x: list(x.itertuples(index=False, name=None)))
    .to_dict()
)

markdown_lines=[]

for cat,item in category_dict.items():
    markdown_lines.append(f"### {cat}")
    markdown_lines.append("")
    markdown_lines.append(f"| Sub category |Meter Run| No. of Tiers| Shelf Run |")
    markdown_lines.append("| -------------|----------|----------| ---------- |")

    for subcat,meter_run, tiers, shelf_run in item:            # Loop through list of tuples
        markdown_lines.append(f"| {subcat} |{meter_run:.2f}| {tiers}| {shelf_run:.1f} |")
    markdown_lines.append("")

final_markdown="\n".join(markdown_lines)

if empty_rows.empty == False:
    empty_lines=[]
    empty_lines.append("\n---\n")
    empty_lines.append(f"# Summary of excluded data due to no assigned category")
    empty_lines.append(f"## To include them ammend exsiting label files or raw data")
    empty_text = empty_rows.to_markdown(index=False)  # index=False to skip row numbers
    empty_lines.append(empty_text)
    final_markdown += "\n\n" + "\n".join(empty_lines)

if multiple_cat.empty == False:
    multi_lines=[]
    multi_lines.append("\n---\n")
    multi_lines.append(f"# Summary of excluded data due to multiple assigned category")
    multi_lines.append(f"## To include them ammend exsiting label files to ensure all edge cases are accounted for")
    multi_text = multiple_cat.to_markdown(index=False)  # index=False to skip row numbers
    multi_lines.append(empty_text)
    final_markdown += "\n\n" + "\n".join(multi_lines)


pypandoc.convert_text(
    final_markdown,          # your Markdown content
    'docx',                   # target format
    format='md',              # input format
    outputfile=out_path,
    extra_args=['--standalone']
)